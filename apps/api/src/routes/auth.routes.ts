import { Router } from 'express';
import { authService } from '../services/auth.service.js';
import { RegisterSchema, LoginSchema } from '@leadfetcher/shared';
import { handleValidationError } from '../middleware/errorHandler.middleware.js';
import { logger } from '../utils/logger.js';

const router = Router();

// ─── POST /api/auth/register ─────────────────────────────────
router.post('/register', async (req, res, next) => {
  try {
    const parsed = RegisterSchema.safeParse(req.body);
    if (!parsed.success) {
      handleValidationError(res, parsed.error);
      return;
    }

    const result = await authService.register(parsed.data);

    // Set httpOnly cookie with JWT
    res.cookie('token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });

    res.status(201).json({ success: true, data: result });
  } catch (err: any) {
    if (err.statusCode) {
      res.status(err.statusCode).json({ success: false, error: err.message });
      return;
    }
    next(err);
  }
});

// ─── POST /api/auth/login ────────────────────────────────────
router.post('/login', async (req, res, next) => {
  try {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
      handleValidationError(res, parsed.error);
      return;
    }

    const result = await authService.login(parsed.data);

    // Set httpOnly cookie with JWT
    res.cookie('token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });

    res.json({ success: true, data: result });
  } catch (err: any) {
    if (err.statusCode) {
      res.status(err.statusCode).json({ success: false, error: err.message });
      return;
    }
    next(err);
  }
});

// ─── POST /api/auth/logout ───────────────────────────────────
router.post('/logout', (_req, res) => {
  res.clearCookie('token', { path: '/' });
  res.json({ success: true, message: 'Logged out' });
});

// ─── GET /api/auth/me — Get current user info ────────────────
router.get('/me', async (req, res) => {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Not authenticated' });
    return;
  }
  res.json({ success: true, data: { user: req.user } });
});

export default router;