import '../config/dotenv.js';
import { getDb } from '../config/database.js';
import { plans, tenants, users } from './schema.js';
import { PLAN_LIMITS } from '@leadfetcher/shared';
import { hashPassword } from '../utils/hash.js';
import { getEnv } from '../config/env.js';
import { eq } from 'drizzle-orm';
import { closeDb } from '../config/database.js';

async function seed() {
  const env = getEnv();
  const db = getDb();

  console.log('🌱 Seeding database...\n');

  // ─── 1. Seed Plans ─────────────────────────────────────────
  console.log('📋 Creating plans...');
  const createdPlans: Record<string, string> = {};

  for (const [key, limits] of Object.entries(PLAN_LIMITS)) {
    // Upsert: check if exists first
    const [existing] = await db.select({ id: plans.id })
      .from(plans)
      .where(eq(plans.name, limits.name))
      .limit(1);

    if (existing) {
      console.log(`  ✓ Plan "${limits.name}" already exists`);
      createdPlans[key] = existing.id;
    } else {
      const [plan] = await db.insert(plans).values({
        name: limits.name,
        maxLeadsMonthly: limits.maxLeadsMonthly,
        maxJobsMonthly: limits.maxJobsMonthly,
        maxPagesPerJob: limits.maxPagesPerJob,
        maxConcurrentJobs: limits.maxConcurrentJobs,
        maxExportsMonthly: limits.maxExportsMonthly,
        llmEnabled: limits.llmEnabled,
        maxLlmTokensMonthly: limits.maxLlmTokensMonthly,
        apiRateLimitRpm: limits.apiRateLimitRpm,
        dataRetentionDays: limits.dataRetentionDays,
        priceMonthyCents: limits.priceMonthyCents,
      }).returning();
      console.log(`  ✅ Plan "${limits.name}" created`);
      createdPlans[key] = plan!.id;
    }
  }

  // ─── 2. Seed Super Admin ───────────────────────────────────
  console.log('\n👤 Creating super admin...');

  const [existingAdmin] = await db.select({ id: users.id })
    .from(users)
    .where(eq(users.email, env.SUPER_ADMIN_EMAIL || 'admin@leadfetcher.com'))
    .limit(1);

  if (existingAdmin) {
    console.log('  ✓ Super admin already exists');
  } else {
    // Create admin tenant
    const [adminTenant] = await db.insert(tenants).values({
      name: 'LeadFetcher Admin',
      planId: createdPlans['enterprise']!,
    }).returning();

    // Create admin user
    const passwordHash = await hashPassword(env.SUPER_ADMIN_PASSWORD || 'admin123');
    const [adminUser] = await db.insert(users).values({
      tenantId: adminTenant!.id,
      email: env.SUPER_ADMIN_EMAIL || 'admin@leadfetcher.com',
      passwordHash,
      name: 'Super Admin',
      role: 'super_admin',
    }).returning();

    console.log(`  ✅ Super admin created: ${adminUser!.email}`);
  }

  console.log('\n✅ Seed complete!\n');
  await closeDb();
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});