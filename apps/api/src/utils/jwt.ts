import jwt from 'jsonwebtoken';
import type { JWTPayload } from '@leadfetcher/shared';
import { getEnv } from '../config/env.js';

export function generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  const env = getEnv();
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as any,
  });
}

export function verifyToken(token: string): JWTPayload {
  const env = getEnv();
  return jwt.verify(token, env.JWT_SECRET) as JWTPayload;
}
