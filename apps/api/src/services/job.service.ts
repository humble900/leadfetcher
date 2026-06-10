import { eq, and, desc, sql } from 'drizzle-orm';
import { getDb } from '../config/database.js';
import { jobs, leads } from '../db/schema.js';
import { checkAndIncrementLimit, getCurrentUsage } from '../middleware/limit.middleware.js';
import { logger } from '../utils/logger.js';
import type { JobConfig } from '@leadfetcher/shared';

export class JobService {
  /**
   * Create a new scraping job — tenant scoped, limit enforced
   */
  async createJob(tenantId: string, userId: string, targetUrl: string, config: Partial<JobConfig> = {}) {
    const db = getDb();

    const [job] = await db.insert(jobs).values({
      tenantId,
      createdBy: userId,
      targetUrl,
      config: config as any,
      status: 'queued',
      progress: {
        pagesFound: 0,
        pagesCrawled: 0,
        leadsFound: 0,
        leadsStored: 0,
        errors: 0,
      },
    }).returning();

    logger.info({ jobId: job!.id, tenantId, targetUrl }, 'Job created');

    return job;
  }

  /**
   * Get all jobs for a tenant — ALWAYS tenant scoped
   */
  async getJobs(tenantId: string, page: number = 1, limit: number = 20) {
    const db = getDb();
    const offset = (page - 1) * limit;

    const [countResult] = await db.select({ count: sql<number>`count(*)::int` })
      .from(jobs)
      .where(eq(jobs.tenantId, tenantId));

    const total = countResult?.count || 0;

    const rows = await db.select()
      .from(jobs)
      .where(eq(jobs.tenantId, tenantId))
      .orderBy(desc(jobs.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      data: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Get a single job — tenant scoped
   */
  async getJobById(tenantId: string, jobId: string) {
    const db = getDb();

    const [job] = await db.select()
      .from(jobs)
      .where(and(eq(jobs.id, jobId), eq(jobs.tenantId, tenantId)))
      .limit(1);

    if (!job) {
      throw Object.assign(new Error('Job not found'), { statusCode: 404 });
    }

    return job;
  }

  /**
   * Get count of currently running jobs for a tenant
   */
  async getRunningJobCount(tenantId: string): Promise<number> {
    const db = getDb();

    const [result] = await db.select({ count: sql<number>`count(*)::int` })
      .from(jobs)
      .where(and(eq(jobs.tenantId, tenantId), eq(jobs.status, 'running')));

    return result?.count || 0;
  }

  /**
   * Update job status
   */
  async updateJobStatus(jobId: string, status: string, updates: Record<string, any> = {}) {
    const db = getDb();

    const updateData: any = { status, ...updates };

    if (status === 'running' && !updates.startedAt) {
      updateData.startedAt = new Date();
    }
    if (['completed', 'failed', 'cancelled'].includes(status) && !updates.completedAt) {
      updateData.completedAt = new Date();
    }

    const [updated] = await db.update(jobs)
      .set(updateData)
      .where(eq(jobs.id, jobId))
      .returning();

    return updated;
  }

  /**
   * Update job progress
   */
  async updateJobProgress(jobId: string, progress: Record<string, any>) {
    const db = getDb();

    const [updated] = await db.update(jobs)
      .set({ progress: progress as any })
      .where(eq(jobs.id, jobId))
      .returning();

    return updated;
  }

  /**
   * Cancel a job — tenant scoped
   */
  async cancelJob(tenantId: string, jobId: string) {
    const job = await this.getJobById(tenantId, jobId);

    if (!['queued', 'running'].includes(job.status)) {
      throw Object.assign(new Error('Job cannot be cancelled in its current state'), { statusCode: 400 });
    }

    return this.updateJobStatus(jobId, 'cancelled');
  }
}

export const jobService = new JobService();