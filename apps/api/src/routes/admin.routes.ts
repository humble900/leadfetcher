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
      customLimits: tenants.customLimits,
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

// ─── PUT /api/admin/tenants/:id/plan — Change tenant plan & limits ───
router.put('/tenants/:id/plan', async (req, res, next) => {
  try {
    const db = getDb();
    const { planId, customLimits } = req.body;

    const updateFields: any = { updatedAt: new Date() };

    if (planId) {
      // Verify plan exists
      const [plan] = await db.select().from(plans).where(eq(plans.id, planId)).limit(1);
      if (!plan) {
        res.status(404).json({ success: false, error: 'Plan not found' });
        return;
      }
      updateFields.planId = planId;
    }

    if (customLimits !== undefined) {
      updateFields.customLimits = customLimits;
    }

    if (!planId && customLimits === undefined) {
      res.status(400).json({ success: false, error: 'planId or customLimits is required' });
      return;
    }

    // Update tenant plan and/or custom limits
    const [updated] = await db.update(tenants)
      .set(updateFields)
      .where(eq(tenants.id, req.params.id!))
      .returning();

    if (!updated) {
      res.status(404).json({ success: false, error: 'Tenant not found' });
      return;
    }

    // Invalidate cached plan info
    const redis = getRedis();
    await redis.del(`plan:${req.params.id}`);

    logger.info({ tenantId: req.params.id, ...updateFields }, 'Tenant plan/limits updated');
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

// ─── Platform settings (in-memory, persists per server lifecycle) ─
export let platformSettings = {
  paidMode: false,
  maintenanceMode: false,
  defaultPlanName: 'free',
  maxTenantsAllowed: 10000,
  signupsEnabled: true,
  paymentMode: 'manual' as 'manual' | 'automatic',
  whatsappNumber: '+14094229714',
};

// ─── GET /api/admin/settings — Get platform settings ─────────
router.get('/settings', async (_req, res) => {
  res.json({
    success: true,
    data: {
      ...platformSettings,
      paidVersionActive: platformSettings.paidMode,
    },
  });
});

// ─── PUT/POST /api/admin/settings — Update platform settings ──
const updateSettingsHandler = async (req: any, res: any) => {
  const allowed = [
    'paidMode',
    'paidVersionActive',
    'maintenanceMode',
    'defaultPlanName',
    'maxTenantsAllowed',
    'signupsEnabled',
    'paymentMode',
    'whatsappNumber',
  ];
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      if (key === 'paidVersionActive') {
        platformSettings.paidMode = req.body[key];
      } else {
        (platformSettings as any)[key] = req.body[key];
      }
    }
  }
  logger.info({ settings: platformSettings }, 'Platform settings updated');
  res.json({
    success: true,
    data: {
      ...platformSettings,
      paidVersionActive: platformSettings.paidMode,
    },
  });
};

router.put('/settings', updateSettingsHandler);
router.post('/settings', updateSettingsHandler);

// ─── GET /api/admin/plans — List all plans ───────────────────
router.get('/plans', async (_req, res, next) => {
  try {
    const db = getDb();
    const rows = await db.select().from(plans);
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

export default router;