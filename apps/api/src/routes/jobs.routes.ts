import { Router } from 'express';
import { jobService } from '../services/job.service.js';
import { CreateJobSchema } from '@leadfetcher/shared';
import { handleValidationError } from '../middleware/errorHandler.middleware.js';
import { limitMiddleware, checkAndIncrementLimit } from '../middleware/limit.middleware.js';
import { getDb } from '../config/database.js';
import { plans } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { getJobsQueue } from '../config/queue.js';

const router = Router();

// ─── POST /api/jobs — Create a new scraping job ──────────────
router.post('/',
  limitMiddleware('jobs_monthly', 'maxJobsMonthly'),
  async (req, res, next) => {
    try {
      const parsed = CreateJobSchema.safeParse(req.body);
      if (!parsed.success) {
        handleValidationError(res, parsed.error);
        return;
      }

      // Check concurrent job limit
      const runningCount = await jobService.getRunningJobCount(req.tenantId!);
      const db = getDb();
      const [plan] = await db.select().from(plans).where(eq(plans.id, req.user!.planId)).limit(1);

      if (plan && runningCount >= plan.maxConcurrentJobs) {
        res.status(429).json({
          success: false,
          error: `Maximum concurrent jobs reached (${plan.maxConcurrentJobs}). Wait for a running job to finish or upgrade your plan.`,
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
          maxPagesPerJob: plan?.maxPagesPerJob ?? 10,
          maxLeadsMonthly: plan?.maxLeadsMonthly ?? 500,
          maxConcurrentJobs: plan?.maxConcurrentJobs ?? 2,
          llmEnabled: plan?.llmEnabled ?? false,
          maxLlmTokensMonthly: plan?.maxLlmTokensMonthly ?? 0,
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