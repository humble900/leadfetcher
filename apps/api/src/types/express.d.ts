import type { JWTPayload } from '@leadfetcher/shared';

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
      tenantId?: string;
    }
  }
}
export {};
