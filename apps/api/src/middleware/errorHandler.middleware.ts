import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

/**
 * Global error handler — catches all unhandled errors.
 * Never leaks internal details to the client.
 */
export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction): void {
  // Log the full error internally
  logger.error({
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    tenantId: req.tenantId,
    userId: req.user?.userId,
  }, 'Unhandled error');

  // Never send stack traces or internal details to client
  const statusCode = err.statusCode || err.status || 500;
  const message = statusCode === 500
    ? 'Internal server error'
    : err.message || 'Something went wrong';

  res.status(statusCode).json({
    success: false,
    error: message,
  });
}

/**
 * Zod validation error handler
 */
export function handleValidationError(res: Response, error: any): void {
  if (error.name === 'ZodError') {
    const issues = error.issues.map((i: any) => ({
      field: i.path.join('.'),
      message: i.message,
    }));
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: issues,
    });
    return;
  }
  throw error; // re-throw non-validation errors
}
