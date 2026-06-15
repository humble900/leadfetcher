/**
 * BullMQ Worker — Listens for scraping jobs from the queue and processes them.
 *
 * Runs as a SEPARATE process from the API server.
 * Has its own DB and Redis connections.
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

const worker = new Worker(
  'scrape-jobs',
  async (job: Job) => {
    logger.info({ jobId: job.id, data: job.data }, 'Processing job');

    await processJob({
      jobId: job.data.jobId,
      tenantId: job.data.tenantId,
      targetUrl: job.data.targetUrl,
      config: job.data.config || {},
      planLimits: job.data.planLimits,
      databaseUrl: DATABASE_URL,
      redisUrl: REDIS_URL,
      onProgress: (progress) => {
        job.updateProgress(progress);
      },
      onActivity: (agent, message) => {
        logger.info({ agent, message, jobId: job.data.jobId }, 'Agent activity');
      },
      onLead: (lead) => {
        logger.debug({ vendorName: lead.vendorName, jobId: job.data.jobId }, 'Lead extracted');
      },
    });
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
});

worker.on('error', (error) => {
  logger.error({ error: error.message }, 'Worker error');
});

logger.info('🔧 Worker started, listening for scrape jobs...');

// Graceful shutdown
async function shutdown(signal: string) {
  logger.info({ signal }, 'Worker shutting down...');
  await worker.close();
  await connection.quit();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));