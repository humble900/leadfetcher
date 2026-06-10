import { z } from 'zod';

// ─── Registration ────────────────────────────────────────────
export const RegisterSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  name: z.string().min(2).max(255),
  organizationName: z.string().min(2).max(255).optional(),
});

export type RegisterRequest = z.infer<typeof RegisterSchema>;

// ─── Login ───────────────────────────────────────────────────
export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginRequest = z.infer<typeof LoginSchema>;

// ─── JWT Payload (server-generated, never from client) ──────
export const JWTPayloadSchema = z.object({
  userId: z.string().uuid(),
  tenantId: z.string().uuid(),
  role: z.enum(['owner', 'admin', 'member', 'super_admin']),
  planId: z.string().uuid(),
  iat: z.number().optional(),
  exp: z.number().optional(),
});

export type JWTPayload = z.infer<typeof JWTPayloadSchema>;

// ─── User roles ──────────────────────────────────────────────
export const UserRoleEnum = z.enum(['owner', 'admin', 'member', 'super_admin']);
export type UserRole = z.infer<typeof UserRoleEnum>;

// ─── Change password ─────────────────────────────────────────
export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

export type ChangePasswordRequest = z.infer<typeof ChangePasswordSchema>;
