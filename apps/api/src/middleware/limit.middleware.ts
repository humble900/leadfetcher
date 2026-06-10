import type { Request, Response, NextFunction } from 'express';
import { getRedis } from '../config/redis.js';
import { getDb } from '../config/database.js';
import { plans } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger.js';

/**
 * Get current billing period key (YYYY-MM)
 */
function getMonthlyPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Get current daily period key (YYYY-MM-DD)
 */
function getDailyPeriod(): string {
  return new Date().toISOString().split('T')[0]!;
}

/**
 * Get TTL in seconds for a period type
 */
function getPeriodTTL(type: 'monthly' | 'daily' | 'minute'): number {
  switch (type) {
    case 'monthly': return 35 * 24 * 60 * 60; // 35 days (buffer)
    case 'daily': return 2 * 24 * 60 * 60;     // 2 days (buffer)
    case 'minute': return 120;                   // 2 minutes (buffer)
  }
}

/**
 * Atomically check and increment a limit counter in Redis.
 * Returns { allowed, used, limit, remaining } or throws if over limit.
 */
export async function checkAndIncrementLimit(
  tenantId: string,
  limitType: string,
  maxAllowed: number,
  period: 'monthly' | 'daily' | 'minute' = 'monthly',
  incrementBy: number = 1,
): Promise<{ allowed: boolean; used: number; limit: number; remaining: number }> {
  const redis = getRedis();
  const periodKey = period === 'monthly' ? getMonthlyPeriod()
    : period === 'daily' ? getDailyPeriod()
    : Math.floor(Date.now() / 60000).toString(); // minute bucket

  const key = `limit:${limitType}:${tenantId}:${periodKey}`;

  // INCRBY is atomic — even concurrent requests cannot race past the limit
  const current = await redis.incrby(key, incrementBy);

  // Set expiry on first write (idempotent if already set)
  if (current === incrementBy) {
    await redis.expire(key, getPeriodTTL(period));
  }

  if (current > maxAllowed) {
    // Roll back the increment since we're over limit
    await redis.decrby(key, incrementBy);
    return { allowed: false, used: current - incrementBy, limit: maxAllowed, remaining: 0 };
  }

  return { allowed: true, used: current, limit: maxAllowed, remaining: maxAllowed - current };
}

/**
 * Get current usage for a specific limit type without incrementing
 */
export async function getCurrentUsage(
  tenantId: string,
  limitType: string,
  period: 'monthly' | 'daily' | 'minute' = 'monthly',
): Promise<number> {
  const redis = getRedis();
  const periodKey = period === 'monthly' ? getMonthlyPeriod()
    : period === 'daily' ? getDailyPeriod()
    : Math.floor(Date.now() / 60000).toString();

  const key = `limit:${limitType}:${tenantId}:${periodKey}`;
  const value = await redis.get(key);
  return value ? parseInt(value, 10) : 0;
}

/**
 * Middleware factory — checks a specific limit before allowing the request
 */
export function limitMiddleware(limitType: string, planField: keyof typeof plans.$inferSelect) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.planId) {
        next();
        return;
      }

      const db = getDb();
      const [plan] = await db.select().from(plans).where(eq(plans.id, req.user.planId)).limit(1);

      if (!plan) {
        next();
        return;
      }

      const maxAllowed = (plan as any)[planField] as number;
      const result = await checkAndIncrementLimit(req.tenantId!, limitType, maxAllowed);

      if (!result.allowed) {
        res.status(429).json({
          success: false,
          error: `Monthly ${limitType.replace('_', ' ')} limit reached (${result.limit}). Upgrade your plan for more.`,
          usage: result,
        });
        return;
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Rate limit middleware — uses sliding window per-minute
 */
export async function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  // Skip rate limiting for health checks
  if (req.path === '/api/health') {
    next();
    return;
  }

  // Only rate-limit authenticated requests
  if (!req.tenantId) {
    next();
    return;
  }

  try {
    const result = await checkAndIncrementLimit(
      req.tenantId,
      'api_rate',
      120, // default RPM
      'minute',
    );

    if (!result.allowed) {
      res.status(429).json({
        success: false,
        error: 'Rate limit exceeded. Please slow down.',
      });
      return;
    }

    next();
  } catch {
    next();
  }
}