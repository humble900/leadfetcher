/**
 * BullMQ Worker — Listens for scraping jobs from the queue and processes them.
 *
 * Runs as a SEPARATE process from the API server.
 * Has its own DB and Redis connections.
 *
 * Publishes real-time progress/activity events via Redis Pub/Sub
 * so the API can relay them to dashboards over SSE.
 */

import './config/dotenv.js';
import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import pino from 'pino';
import { processJob } from './processors/job.processor.js';

const logger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
});

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const DATABASE_URL = process.env.DATABASE_URL || '';

const connection = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null, // Required by BullMQ
});

// Separate Redis client for Pub/Sub publishing (cannot share with BullMQ connection)
const pubClient = new Redis(REDIS_URL);

const worker = new Worker(
  'scrape-jobs',
  async (job: Job) => {
    logger.info({ jobId: job.id, data: job.data }, 'Processing job');

    const jobId = job.data.jobId;
    const channel = `job:${jobId}:events`;

    await processJob({
      jobId,
      tenantId: job.data.tenantId,
      targetUrl: job.data.targetUrl,
      config: job.data.config || {},
      planLimits: job.data.planLimits,
      databaseUrl: DATABASE_URL,
      redisUrl: REDIS_URL,
      onProgress: (progress) => {
        job.updateProgress(progress);
        // Publish progress event via Redis pub/sub for SSE
        pubClient.publish(channel, JSON.stringify({
          type: 'progress',
          data: progress,
        })).catch((err) => logger.error({ err }, 'Failed to publish progress'));
      },
      onActivity: (agent, message) => {
        logger.info({ agent, message, jobId }, 'Agent activity');
        // Publish activity event via Redis pub/sub for SSE
        pubClient.publish(channel, JSON.stringify({
          type: 'activity',
          data: { agent, message, timestamp: new Date().toISOString() },
        })).catch((err) => logger.error({ err }, 'Failed to publish activity'));
      },
      onLead: (lead) => {
        logger.debug({ vendorName: lead.vendorName, jobId }, 'Lead extracted');
      },
    });

    // Notify that the job has completed
    pubClient.publish(channel, JSON.stringify({
      type: 'done',
      data: { status: 'completed' },
    })).catch((err) => logger.error({ err }, 'Failed to publish done'));
  },
  {
    connection: connection as any,
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '2'),
    limiter: {
      max: 5,
      duration: 1000,
    },
    skipVersionCheck: true,
  },
);

worker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Job completed successfully');
});

worker.on('failed', (job, error) => {
  logger.error({ jobId: job?.id, error: error.message }, 'Job failed');
  // Publish failure event so SSE clients know the job is done
  if (job?.data?.jobId) {
    pubClient.publish(`job:${job.data.jobId}:events`, JSON.stringify({
      type: 'done',
      data: { status: 'failed', error: error.message },
    })).catch(() => {});
  }
});

worker.on('error', (error) => {
  logger.error({ error: error.message }, 'Worker error');
});

logger.info('🔧 Worker started, listening for scrape jobs...');

// Graceful shutdown
async function shutdown(signal: string) {
  logger.info({ signal }, 'Worker shutting down...');
  await worker.close();
  await pubClient.quit();
  await connection.quit();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));