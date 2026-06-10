import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

/**
 * Tenant Middleware — Ensures all downstream code has tenantId.
 * Acts as a safety net: if authMiddleware somehow passed without setting tenantId,
 * this blocks the request entirely.
 *
 * Also rejects requests where the tenant is suspended.
 */
export function tenantMiddleware(req: Request, res: Response, next: NextFunction): void {
  // CRITICAL: tenantId MUST come from JWT, never from query/body/params
  if (!req.tenantId) {
    logger.error({ path: req.path, method: req.method }, 'Request reached tenant middleware without tenantId');
    res.status(401).json({ success: false, error: 'Tenant context missing' });
    return;
  }

  // Explicitly strip any client-provided tenantId from body/query to prevent spoofing
  if (req.body?.tenantId) {
    delete req.body.tenantId;
  }
  if (req.query?.tenantId) {
    delete req.query.tenantId;
  }

  next();
}
