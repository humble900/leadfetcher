import { Router } from 'express';
import { jobService } from '../services/job.service.js';
import { CreateJobSchema } from '@leadfetcher/shared';
import { handleValidationError } from '../middleware/errorHandler.middleware.js';
import { limitMiddleware, checkAndIncrementLimit } from '../middleware/limit.middleware.js';
import { getDb } from '../config/database.js';
import { plans, tenants } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { getJobsQueue } from '../config/queue.js';
import { Redis } from 'ioredis';
import { getEnv } from '../config/env.js';
import { verifyToken } from '../utils/jwt.js';

const router = Router();

// ─── POST /api/jobs — Create a new scraping job ──────────────
router.post('/',
  limitMiddleware('jobs_monthly', 'maxJobsMonthly'),
  async (req, res, next) => {
    try {
      // Pre-populate targetUrl for Prospector jobs if missing
      if (req.body?.config?.type === 'prospector' && !req.body.targetUrl) {
        req.body.targetUrl = 'prospector://queue';
      }

      const parsed = CreateJobSchema.safeParse(req.body);
      if (!parsed.success) {
        handleValidationError(res, parsed.error);
        return;
      }

      // Enforce HTTP/HTTPS protocol for web scraper jobs
      const jobType = parsed.data.config?.type;
      if (!jobType || jobType === 'web_scraper') {
        try {
          const url = new URL(parsed.data.targetUrl);
          if (!['http:', 'https:'].includes(url.protocol)) {
            throw new Error();
          }
        } catch {
          res.status(400).json({
            success: false,
            error: 'Target URL must be a valid HTTP or HTTPS URL for web scraping jobs.',
          });
          return;
        }
      }

      // Check concurrent job limit
      const runningCount = await jobService.getRunningJobCount(req.tenantId!);
      const db = getDb();
      const [plan] = await db.select().from(plans).where(eq(plans.id, req.user!.planId)).limit(1);

      const [tenant] = await db.select({
        customLimits: tenants.customLimits
      }).from(tenants).where(eq(tenants.id, req.tenantId!)).limit(1);

      const getLimit = (field: keyof typeof plans.$inferSelect, defaultVal: any) => {
        let val = plan ? (plan as any)[field] : defaultVal;
        if (tenant?.customLimits && typeof tenant.customLimits === 'object') {
          const customValue = (tenant.customLimits as any)[field];
          if (customValue !== undefined && customValue !== null) {
            if (typeof defaultVal === 'boolean') {
              val = customValue === true || customValue === 'true';
            } else if (!isNaN(Number(customValue))) {
              val = Number(customValue);
            }
          }
        }
        return val;
      };

      const maxConcurrent = getLimit('maxConcurrentJobs', 2);

      if (runningCount >= maxConcurrent) {
        res.status(429).json({
          success: false,
          error: `Maximum concurrent jobs reached (${maxConcurrent}). Wait for a running job to finish or upgrade your plan.`,
        });
        return;
      }

      const job = await jobService.createJob(
        req.tenantId!,
        req.user!.userId,
        parsed.data.targetUrl,
        parsed.data.config,
      );

      // Add job to BullMQ queue
      const queue = getJobsQueue();
      await queue.add('scrape-job', {
        jobId: job.id,
        tenantId: req.tenantId!,
        targetUrl: parsed.data.targetUrl,
        config: parsed.data.config || {},
        planLimits: {
          maxPagesPerJob: getLimit('maxPagesPerJob', 10),
          maxLeadsMonthly: getLimit('maxLeadsMonthly', 500),
          maxConcurrentJobs: maxConcurrent,
          llmEnabled: getLimit('llmEnabled', false),
          maxLlmTokensMonthly: getLimit('maxLlmTokensMonthly', 0),
        },
      });

      res.status(201).json({ success: true, data: job });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/jobs — List my jobs ────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

    const result = await jobService.getJobs(req.tenantId!, page, limit);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/jobs/:id/stream — Real-time SSE event stream ──
// This MUST come before the /:id route so Express doesn't match "stream" as an id.
router.get('/:id/stream', async (req, res) => {
  const jobId = req.params.id!;

  // EventSource can't send custom headers, so support ?token= query param as fallback
  // Cookie-based auth is already handled by authMiddleware upstream.
  // If authMiddleware didn't populate req.user (e.g. token query param scenario),
  // we verify here. But since jobs routes have authMiddleware globally, req.user is set.
  if (!req.user || !req.tenantId) {
    // Attempt token from query param
    const queryToken = req.query.token as string;
    if (queryToken) {
      try {
        const payload = verifyToken(queryToken);
        req.user = payload;
        req.tenantId = payload.tenantId;
      } catch {
        res.status(401).json({ success: false, error: 'Invalid token' });
        return;
      }
    } else {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }
  }

  // Verify the job belongs to this tenant
  try {
    await jobService.getJobById(req.tenantId!, jobId);
  } catch (err: any) {
    if (err.statusCode === 404) {
      res.status(404).json({ success: false, error: 'Job not found' });
      return;
    }
    res.status(500).json({ success: false, error: 'Internal server error' });
    return;
  }

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // Disable nginx buffering
  });

  // Send initial connected event
  res.write(`event: connected\ndata: ${JSON.stringify({ jobId, timestamp: new Date().toISOString() })}\n\n`);

  // Create a dedicated Redis subscriber for this SSE connection
  const subscriber = new Redis(getEnv().REDIS_URL, {
    lazyConnect: false,
  });
  const channel = `job:${jobId}:events`;

  subscriber.subscribe(channel, (err) => {
    if (err) {
      console.error(`Failed to subscribe to ${channel}:`, err);
      res.write(`event: error\ndata: ${JSON.stringify({ message: 'Failed to connect to event stream' })}\n\n`);
      res.end();
      return;
    }
  });

  subscriber.on('message', (_ch: string, message: string) => {
    try {
      const parsed = JSON.parse(message);
      const eventType = parsed.type || 'message';
      res.write(`event: ${eventType}\ndata: ${JSON.stringify(parsed.data)}\n\n`);

      // If job is done, close the stream after a brief delay
      if (eventType === 'done') {
        setTimeout(() => {
          subscriber.unsubscribe(channel).catch(() => {});
          subscriber.quit().catch(() => {});
          res.end();
        }, 500);
      }
    } catch (e) {
      // Forward raw message
      res.write(`data: ${message}\n\n`);
    }
  });

  // Send keep-alive pings every 30 seconds to prevent timeouts
  const keepAliveInterval = setInterval(() => {
    res.write(`: keep-alive\n\n`);
  }, 30000);

  // Cleanup when client disconnects
  req.on('close', () => {
    clearInterval(keepAliveInterval);
    subscriber.unsubscribe(channel).catch(() => {});
    subscriber.quit().catch(() => {});
  });
});

// ─── GET /api/jobs/:id — Get a single job ────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const job = await jobService.getJobById(req.tenantId!, req.params.id!);
    res.json({ success: true, data: job });
  } catch (err: any) {
    if (err.statusCode === 404) {
      res.status(404).json({ success: false, error: err.message });
      return;
    }
    next(err);
  }
});

// ─── POST /api/jobs/:id/cancel — Cancel a running job ────────
router.post('/:id/cancel', async (req, res, next) => {
  try {
    const job = await jobService.cancelJob(req.tenantId!, req.params.id!);
    res.json({ success: true, data: job });
  } catch (err: any) {
    if (err.statusCode) {
      res.status(err.statusCode).json({ success: false, error: err.message });
      return;
    }
    next(err);
  }
});

export default router;