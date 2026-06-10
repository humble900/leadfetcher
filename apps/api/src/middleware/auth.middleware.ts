import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.js';
import { logger } from '../utils/logger.js';
import type { JWTPayload } from '@leadfetcher/shared';

// Extend Express Request type to include auth data
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
      tenantId?: string;
    }
  }
}

/**
 * Auth Middleware — Verifies JWT from httpOnly cookie.
 * NEVER trusts client-supplied tenantId — always extracts from verified JWT.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  try {
    // 1. Extract token from httpOnly cookie (preferred) or Authorization header (fallback for API clients)
    let token = req.cookies?.token;

    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.slice(7);
      }
    }

    if (!token) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    // 2. Verify JWT signature and expiry
    const payload = verifyToken(token);

    // 3. Inject verified user info into request — THIS IS THE ONLY SOURCE OF TRUTH
    req.user = payload;
    req.tenantId = payload.tenantId;

    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      res.status(401).json({ success: false, error: 'Token expired. Please login again.' });
      return;
    }
    if (error.name === 'JsonWebTokenError') {
      logger.warn({ error: error.message, ip: req.ip }, 'Invalid JWT attempt');
      res.status(401).json({ success: false, error: 'Invalid token' });
      return;
    }
    res.status(401).json({ success: false, error: 'Authentication failed' });
  }
}

/**
 * Require specific roles — used after authMiddleware
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ success: false, error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}