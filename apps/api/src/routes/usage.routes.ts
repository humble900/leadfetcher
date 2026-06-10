import { Router } from 'express';
import { usageService } from '../services/usage.service.js';

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

export default router;
