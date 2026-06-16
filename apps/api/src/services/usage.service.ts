import { eq } from 'drizzle-orm';
import { getDb } from '../config/database.js';
import { plans, tenants } from '../db/schema.js';
import { getCurrentUsage } from '../middleware/limit.middleware.js';
import type { UsageInfo } from '@leadfetcher/shared';

export class UsageService {
  /**
   * Get full usage breakdown for a tenant — shows used vs limit for each dimension
   */
  async getUsage(tenantId: string, planId: string): Promise<UsageInfo> {
    const db = getDb();

    // Load plan limits
    const [plan] = await db.select().from(plans).where(eq(plans.id, planId)).limit(1);
    if (!plan) {
      throw Object.assign(new Error('Plan not found'), { statusCode: 500 });
    }

    // Load tenant custom limits override
    const [tenant] = await db.select({
      customLimits: tenants.customLimits
    }).from(tenants).where(eq(tenants.id, tenantId)).limit(1);

    const getLimit = (field: keyof typeof plans.$inferSelect) => {
      let maxAllowed = (plan as any)[field] as number;
      if (tenant?.customLimits && typeof tenant.customLimits === 'object') {
        const customValue = (tenant.customLimits as any)[field];
        if (customValue !== undefined && customValue !== null && !isNaN(Number(customValue))) {
          maxAllowed = Number(customValue);
        }
      }
      return maxAllowed;
    };

    // Get current usage from Redis counters
    const [leadsUsed, jobsUsed, exportsUsed, concurrentUsed, llmUsed] = await Promise.all([
      getCurrentUsage(tenantId, 'leads_monthly'),
      getCurrentUsage(tenantId, 'jobs_monthly'),
      getCurrentUsage(tenantId, 'exports_monthly'),
      getCurrentUsage(tenantId, 'concurrent_jobs'),
      getCurrentUsage(tenantId, 'llm_tokens_monthly'),
    ]);

    const buildMetric = (used: number, limit: number) => ({
      used,
      limit,
      percentage: limit > 0 ? Math.min(Math.round((used / limit) * 100), 100) : 0,
    });

    return {
      leadsMonthly: buildMetric(leadsUsed, getLimit('maxLeadsMonthly')),
      jobsMonthly: buildMetric(jobsUsed, getLimit('maxJobsMonthly')),
      exportsMonthly: buildMetric(exportsUsed, getLimit('maxExportsMonthly')),
      concurrentJobs: buildMetric(concurrentUsed, getLimit('maxConcurrentJobs')),
      llmTokensMonthly: buildMetric(llmUsed, getLimit('maxLlmTokensMonthly')),
    };
  }
}

export const usageService = new UsageService();
