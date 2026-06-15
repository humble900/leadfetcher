import { processJob } from './processors/job.processor.js';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './processors/db-schema.js';
import { eq } from 'drizzle-orm';
import './config/dotenv.js';

const { Pool } = pg;

async function runTest(
  name: string,
  db: any,
  tenantId: string,
  userId: string,
  targetUrl: string,
  config: any,
  databaseUrl: string,
  redisUrl: string
) {
  console.log(`\n==================================================`);
  console.log(`🚀 RUNNING TEST: ${name}`);
  console.log(`==================================================`);

  // Create job entry
  const [job] = await db.insert(schema.jobs).values({
    tenantId,
    createdBy: userId,
    targetUrl,
    status: 'queued',
    config,
    progress: { pagesFound: 0, pagesCrawled: 0, leadsFound: 0, leadsStored: 0, errors: 0 },
  }).returning();

  const jobId = job!.id;
  console.log(`Created test job ID: ${jobId}`);

  try {
    await processJob({
      jobId,
      tenantId,
      targetUrl,
      config,
      planLimits: {
        maxPagesPerJob: 5,
        maxLeadsMonthly: 10000,
        maxConcurrentJobs: 5,
        llmEnabled: false,
        maxLlmTokensMonthly: 0,
      },
      databaseUrl,
      redisUrl,
      onProgress: (progress) => {
        console.log(`[Progress] ${JSON.stringify(progress)}`);
      },
      onActivity: (agent, message) => {
        console.log(`[Activity] [${agent}] ${message}`);
      },
      onLead: (lead) => {
        console.log(`[Lead Extracted] ${lead.vendorName} | ${lead.email || '-'} | ${lead.phone || '-'}`);
      },
    });
    console.log(`✅ TEST SUCCESSFUL: ${name}\n`);
  } catch (err) {
    console.error(`❌ TEST FAILED: ${name}:`, err);
  }
}

import { pgTable, uuid } from 'drizzle-orm/pg-core';

const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
});

async function main() {
  const databaseUrl = process.env.DATABASE_URL || '';
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool, { schema });

  // Get first user and tenant
  const [user] = await db.select().from(users).limit(1);
  if (!user) {
    console.error('No users found in database. Run seed first.');
    process.exit(1);
  }

  const tenantId = user.tenantId;
  const userId = user.id;

  console.log(`Loaded Test Tenant ID: ${tenantId}`);
  console.log(`Loaded Test User ID: ${userId}`);

  // Test 1: General Web Crawler
  await runTest(
    'General Web Crawler (listing)',
    db,
    tenantId,
    userId,
    'https://example.com',
    { maxPages: 1, crawlDelay: 'aggressive' },
    databaseUrl,
    redisUrl
  );

  // Test 2: Google Maps Scraper
  await runTest(
    'Google Maps Scraper',
    db,
    tenantId,
    userId,
    'bakery in Paris',
    { type: 'google_maps', maxPages: 1, crawlDelay: 'aggressive' },
    databaseUrl,
    redisUrl
  );

  // Test 3: Company Prospector
  await runTest(
    'Company Prospector',
    db,
    tenantId,
    userId,
    'prospector://queue',
    { type: 'prospector', companies: ['stripe'] },
    databaseUrl,
    redisUrl
  );

  await pool.end();
  console.log('\n🌟 All test executions complete!');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Main test wrapper failed:', err);
  process.exit(1);
});
