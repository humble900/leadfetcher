import { z } from 'zod';

// ─── Job Configuration (user input) ─────────────────────────
export const JobConfigSchema = z.object({
  targetUrl: z.string().url().optional(),
  maxPages: z.number().int().min(1).max(10000).optional(), // server will cap to plan limit
  maxDepth: z.number().int().min(1).max(5).default(2),
  crawlDelay: z.enum(['polite', 'normal', 'aggressive']).default('normal'),
  enableLLM: z.boolean().default(false),
  categories: z.array(z.string()).optional(), // specific categories to crawl
  customSelectors: z.object({
    vendorName: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
    price: z.string().optional(),
    location: z.string().optional(),
    listingLinks: z.string().optional(),
    nextPage: z.string().optional(),
  }).optional(),
});

export type JobConfig = z.infer<typeof JobConfigSchema>;

// ─── Job Status ──────────────────────────────────────────────
export const JobStatusEnum = z.enum([
  'queued',
  'running',
  'paused',
  'completed',
  'failed',
  'cancelled',
]);

export type JobStatus = z.infer<typeof JobStatusEnum>;

// ─── Job Progress ────────────────────────────────────────────
export const JobProgressSchema = z.object({
  pagesFound: z.number().int().default(0),
  pagesCrawled: z.number().int().default(0),
  leadsFound: z.number().int().default(0),
  leadsStored: z.number().int().default(0),
  errors: z.number().int().default(0),
  currentUrl: z.string().optional(),
  currentAgent: z.string().optional(),
  startedAt: z.string().datetime().optional(),
  estimatedCompletion: z.string().datetime().optional(),
});

export type JobProgress = z.infer<typeof JobProgressSchema>;

// ─── Full Job (stored in DB) ─────────────────────────────────
export const FullJobSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  createdBy: z.string().uuid(),
  targetUrl: z.string().url(),
  config: JobConfigSchema.default({}),
  status: JobStatusEnum.default('queued'),
  progress: JobProgressSchema.default({}),
  startedAt: z.string().datetime().nullable().optional(),
  completedAt: z.string().datetime().nullable().optional(),
  errorLog: z.string().nullable().optional(),
  createdAt: z.string().datetime().optional(),
});

export type FullJob = z.infer<typeof FullJobSchema>;

// ─── Create Job (API input) ──────────────────────────────────
export const CreateJobSchema = z.object({
  targetUrl: z.string().url(),
  config: JobConfigSchema.optional().default({}),
});

export type CreateJobInput = z.infer<typeof CreateJobSchema>;
export type CreateJobRequest = CreateJobInput;

// Aliases for backward compatibility
export const JobSchema = FullJobSchema;
export type Job = FullJob;