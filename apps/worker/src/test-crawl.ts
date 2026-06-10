import { processJob } from './processors/job.processor.js';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './processors/db-schema.js';
import { eq } from 'drizzle-orm';
import './config/dotenv.js';

const { Pool } = pg;

/**
 * Test crawl script — run manually to test the scraping pipeline.
 * Usage: npx tsx src/test-crawl.ts <url> [jobId]
 */
async function main() {
  const targetUrl = process.argv[2];
  if (!targetUrl) {
    console.error('Usage: npx tsx src/test-crawl.ts <url> [jobId]');
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_URL || '';
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool, { schema });

  // Get or create a test job
  let jobId = process.argv[3];
  let tenantId: string;

  if (jobId) {
    const [job] = await db.select().from(schema.jobs).where(eq(schema.jobs.id, jobId)).limit(1);
    if (!job) {
      console.error(`Job ${jobId} not found`);
      process.exit(1);
    }
    tenantId = job.tenantId;
  } else {
    // Get first tenant
    const [tenant] = await db.select().from(schema.tenants).limit(1);
    if (!tenant) {
      console.error('No tenants found. Run seed first.');
      process.exit(1);
    }
    tenantId = tenant.id;

    // Get first user
    const [user] = await db.select().from(schema.jobs).limit(1);

    // Create test job
    const [job] = await db.insert(schema.jobs).values({
      tenantId,
      createdBy: tenantId, // Use tenant ID as placeholder
      targetUrl,
      status: 'queued',
      config: {},
      progress: { pagesFound: 0, pagesCrawled: 0, leadsFound: 0, leadsStored: 0, errors: 0 },
    }).returning();

    jobId = job!.id;
    console.log(`Created test job: ${jobId}`);
  }

  console.log(`\n🚀 Starting test crawl of ${targetUrl}\n`);

  await processJob({
    jobId: jobId!,
    tenantId,
    targetUrl,
    config: { maxPages: 10, crawlDelay: 'normal' },
    planLimits: {
      maxPagesPerJob: 100,
      maxLeadsMonthly: 10000,
      maxConcurrentJobs: 1,
      llmEnabled: false,
      maxLlmTokensMonthly: 0,
    },
    databaseUrl,
    redisUrl,
    onProgress: (progress) => {
      console.log(`📊 Progress: ${JSON.stringify(progress)}`);
    },
    onActivity: (agent, message) => {
      console.log(`🤖 [${agent}] ${message}`);
    },
    onLead: (lead) => {
      console.log(`✅ Lead: ${lead.vendorName || 'Unknown'} | ${lead.email || '-'} | ${lead.phone || '-'}`);
    },
  });

  console.log('\n✅ Test crawl complete!');
  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Test crawl failed:', err);
  process.exit(1);
});