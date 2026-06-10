import { eq } from 'drizzle-orm';
import { getDb } from '../config/database.js';
import { users, tenants, plans } from '../db/schema.js';
import { hashPassword, verifyPassword } from '../utils/hash.js';
import { generateToken } from '../utils/jwt.js';
import { logger } from '../utils/logger.js';
import type { RegisterRequest, LoginRequest } from '@leadfetcher/shared';

export class AuthService {
  /**
   * Register a new user + tenant
   */
  async register(data: RegisterRequest) {
    const db = getDb();

    // Check if email already exists
    const [existing] = await db.select({ id: users.id })
      .from(users)
      .where(eq(users.email, data.email.toLowerCase()))
      .limit(1);

    if (existing) {
      throw Object.assign(new Error('Email already registered'), { statusCode: 409 });
    }

    // Get free plan
    const [freePlan] = await db.select()
      .from(plans)
      .where(eq(plans.name, 'Free'))
      .limit(1);

    if (!freePlan) {
      throw new Error('Default plan not found. Run database seed first.');
    }

    // Create tenant
    const [tenant] = await db.insert(tenants).values({
      name: data.organizationName || `${data.name}'s Workspace`,
      planId: freePlan.id,
    }).returning();

    // Create user
    const passwordHash = await hashPassword(data.password);
    const [user] = await db.insert(users).values({
      tenantId: tenant!.id,
      email: data.email.toLowerCase(),
      passwordHash,
      name: data.name,
      role: 'owner',
    }).returning();

    // Generate JWT
    const token = generateToken({
      userId: user!.id,
      tenantId: tenant!.id,
      role: 'owner',
      planId: freePlan.id,
    });

    logger.info({ userId: user!.id, tenantId: tenant!.id }, 'New user registered');

    return {
      token,
      user: {
        id: user!.id,
        email: user!.email,
        name: user!.name,
        role: user!.role,
      },
      tenant: {
        id: tenant!.id,
        name: tenant!.name,
        planId: freePlan.id,
      },
    };
  }

  /**
   * Login existing user
   */
  async login(data: LoginRequest) {
    const db = getDb();

    const [user] = await db.select()
      .from(users)
      .where(eq(users.email, data.email.toLowerCase()))
      .limit(1);

    if (!user) {
      throw Object.assign(new Error('Invalid email or password'), { statusCode: 401 });
    }

    const validPassword = await verifyPassword(data.password, user.passwordHash);
    if (!validPassword) {
      throw Object.assign(new Error('Invalid email or password'), { statusCode: 401 });
    }

    // Get tenant info
    const [tenant] = await db.select()
      .from(tenants)
      .where(eq(tenants.id, user.tenantId))
      .limit(1);

    // Update last login
    await db.update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id));

    const token = generateToken({
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role as 'owner' | 'super_admin' | 'admin' | 'member',
      planId: tenant!.planId,
    });

    logger.info({ userId: user.id }, 'User logged in');

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      tenant: {
        id: tenant!.id,
        name: tenant!.name,
        planId: tenant!.planId,
      },
    };
  }
}

export const authService = new AuthService();