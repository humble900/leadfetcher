import { Router } from 'express';
import { usageService } from '../services/usage.service.js';
import { getDb } from '../config/database.js';
import { plans, tenants } from '../db/schema.js';
import { eq } from 'drizzle-orm';

import { platformSettings } from './admin.routes.js';

const router = Router();

// ─── GET /api/usage — My current usage vs limits ─────────────
router.get('/', async (req, res, next) => {
  try {
    const usage = await usageService.getUsage(req.tenantId!, req.user!.planId);
    res.json({ success: true, data: usage });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/usage/subscription — Plan + pricing info ───────
router.get('/subscription', async (req, res, next) => {
  try {
    const db = getDb();

    // Get current tenant plan
    const [tenant] = await db.select({
      planId: tenants.planId,
    }).from(tenants).where(eq(tenants.id, req.tenantId!)).limit(1);

    const [currentPlan] = await db.select().from(plans).where(eq(plans.id, tenant?.planId || req.user!.planId)).limit(1);

    // Get all available plans
    const allPlans = await db.select().from(plans);

    res.json({
      success: true,
      data: {
        currentPlan: currentPlan || null,
        allPlans,
        paymentMode: platformSettings.paymentMode,
        whatsappNumber: platformSettings.whatsappNumber,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
