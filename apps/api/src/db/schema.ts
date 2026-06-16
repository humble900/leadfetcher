import { pgTable, uuid, varchar, text, integer, boolean, timestamp, jsonb, inet, index, uniqueIndex } from 'drizzle-orm/pg-core';

// ─── Plans ───────────────────────────────────────────────────
export const plans = pgTable('plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 50 }).notNull(),
  maxLeadsMonthly: integer('max_leads_monthly').notNull().default(500),
  maxJobsMonthly: integer('max_jobs_monthly').notNull().default(5),
  maxPagesPerJob: integer('max_pages_per_job').notNull().default(100),
  maxConcurrentJobs: integer('max_concurrent_jobs').notNull().default(1),
  maxExportsMonthly: integer('max_exports_monthly').notNull().default(3),
  llmEnabled: boolean('llm_enabled').default(false),
  maxLlmTokensMonthly: integer('max_llm_tokens_monthly').default(0),
  apiRateLimitRpm: integer('api_rate_limit_rpm').notNull().default(30),
  dataRetentionDays: integer('data_retention_days').notNull().default(30),
  priceMonthyCents: integer('price_monthy_cents').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ─── Tenants ─────────────────────────────────────────────────
export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  planId: uuid('plan_id').notNull().references(() => plans.id),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  customLimits: jsonb('custom_limits').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ─── Users ───────────────────────────────────────────────────
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 255 }).notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  role: varchar('role', { length: 20 }).notNull().default('owner'),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  emailIdx: uniqueIndex('users_email_idx').on(table.email),
}));

// ─── Jobs ────────────────────────────────────────────────────
export const jobs = pgTable('jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  targetUrl: text('target_url').notNull(),
  config: jsonb('config').notNull().default({}),
  status: varchar('status', { length: 20 }).notNull().default('queued'),
  progress: jsonb('progress').notNull().default({ pagesFound: 0, pagesCrawled: 0, leadsFound: 0, leadsStored: 0, errors: 0 }),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  errorLog: text('error_log'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  tenantStatusIdx: index('jobs_tenant_status_idx').on(table.tenantId, table.status),
  tenantCreatedIdx: index('jobs_tenant_created_idx').on(table.tenantId, table.createdAt),
}));

// ─── Leads ───────────────────────────────────────────────────
export const leads = pgTable('leads', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  jobId: uuid('job_id').notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  vendorName: varchar('vendor_name', { length: 500 }),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  whatsapp: varchar('whatsapp', { length: 50 }),
  website: text('website'),
  location: varchar('location', { length: 500 }),
  businessCategory: varchar('business_category', { length: 255 }),
  productName: varchar('product_name', { length: 500 }),
  price: varchar('price', { length: 100 }),
  description: text('description'),
  listingUrl: text('listing_url').notNull(),
  socialMedia: jsonb('social_media').default({}),
  additionalInfo: jsonb('additional_info').default({}),
  qualityScore: integer('quality_score').default(0),
  extractionMethod: varchar('extraction_method', { length: 20 }).default('script'),
  isVerified: boolean('is_verified').default(false),
  isDuplicate: boolean('is_duplicate').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  tenantIdx: index('leads_tenant_idx').on(table.tenantId),
  tenantJobIdx: index('leads_tenant_job_idx').on(table.tenantId, table.jobId),
  tenantEmailIdx: index('leads_tenant_email_idx').on(table.tenantId, table.email),
  tenantPhoneIdx: index('leads_tenant_phone_idx').on(table.tenantId, table.phone),
  dedupIdx: index('leads_dedup_idx').on(table.tenantId, table.email, table.phone, table.vendorName),
}));

// ─── Site Profiles ───────────────────────────────────────────
export const siteProfiles = pgTable('site_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  domain: varchar('domain', { length: 255 }).notNull(),
  displayName: varchar('display_name', { length: 255 }),
  selectors: jsonb('selectors').notNull(),
  pagination: jsonb('pagination').notNull(),
  requiresJs: boolean('requires_js').default(false),
  notes: text('notes'),
  lastVerified: timestamp('last_verified', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  domainIdx: uniqueIndex('site_profiles_domain_idx').on(table.domain),
}));

// ─── Usage Log ───────────────────────────────────────────────
export const usageLog = pgTable('usage_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  action: varchar('action', { length: 50 }).notNull(),
  count: integer('count').default(1),
  metadata: jsonb('metadata').default({}),
  period: varchar('period', { length: 20 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  tenantPeriodIdx: index('usage_tenant_period_idx').on(table.tenantId, table.period, table.action),
}));

// ─── Audit Log ───────────────────────────────────────────────
export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id'),
  userId: uuid('user_id'),
  action: varchar('action', { length: 100 }).notNull(),
  resourceType: varchar('resource_type', { length: 50 }),
  resourceId: uuid('resource_id'),
  ipAddress: inet('ip_address'),
  userAgent: text('user_agent'),
  details: jsonb('details').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  tenantIdx: index('audit_tenant_idx').on(table.tenantId, table.createdAt),
}));