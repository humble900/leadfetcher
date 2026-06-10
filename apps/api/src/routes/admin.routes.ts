import { Router } from 'express';
import { requireRole } from '../middleware/auth.middleware.js';
import { getDb } from '../config/database.js';
import { tenants, users, plans, jobs, leads } from '../db/schema.js';
import { eq, sql, desc } from 'drizzle-orm';
import { logger } from '../utils/logger.js';
import { getRedis } from '../config/redis.js';

const router = Router();

// ALL admin routes require super_admin role
router.use(requireRole('super_admin'));

// ─── GET /api/admin/tenants — List all tenants ───────────────
router.get('/tenants', async (req, res, next) => {
  try {
    const db = getDb();
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = (page - 1) * limit;

    const rows = await db.select({
      id: tenants.id,
      name: tenants.name,
      status: tenants.status,
      planName: plans.name,
      planId: tenants.planId,
      createdAt: tenants.createdAt,
      userCount: sql<number>`(SELECT count(*)::int FROM users WHERE users.tenant_id = ${tenants.id})`,
      jobCount: sql<number>`(SELECT count(*)::int FROM jobs WHERE jobs.tenant_id = ${tenants.id})`,
      leadCount: sql<number>`(SELECT count(*)::int FROM leads WHERE leads.tenant_id = ${tenants.id})`,
    })
      .from(tenants)
      .innerJoin(plans, eq(tenants.planId, plans.id))
      .orderBy(desc(tenants.createdAt))
      .limit(limit)
      .offset(offset);

    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// ─── PUT /api/admin/tenants/:id/plan — Change tenant plan ───
router.put('/tenants/:id/plan', async (req, res, next) => {
  try {
    const db = getDb();
    const { planId } = req.body;

    if (!planId) {
      res.status(400).json({ success: false, error: 'planId is required' });
      return;
    }

    // Verify plan exists
    const [plan] = await db.select().from(plans).where(eq(plans.id, planId)).limit(1);
    if (!plan) {
      res.status(404).json({ success: false, error: 'Plan not found' });
      return;
    }

    // Update tenant plan
    const [updated] = await db.update(tenants)
      .set({ planId, updatedAt: new Date() })
      .where(eq(tenants.id, req.params.id!))
      .returning();

    if (!updated) {
      res.status(404).json({ success: false, error: 'Tenant not found' });
      return;
    }

    // Invalidate cached plan info
    const redis = getRedis();
    await redis.del(`plan:${req.params.id}`);

    logger.info({ tenantId: req.params.id, newPlanId: planId }, 'Tenant plan updated');
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/admin/stats — System-wide statistics ───────────
router.get('/stats', async (_req, res, next) => {
  try {
    const db = getDb();

    const [stats] = await db.select({
      totalTenants: sql<number>`(SELECT count(*)::int FROM tenants)`,
      totalUsers: sql<number>`(SELECT count(*)::int FROM users)`,
      totalJobs: sql<number>`(SELECT count(*)::int FROM jobs)`,
      totalLeads: sql<number>`(SELECT count(*)::int FROM leads)`,
      runningJobs: sql<number>`(SELECT count(*)::int FROM jobs WHERE status = 'running')`,
    }).from(sql`generate_series(1,1)`);

    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
});

export default router;