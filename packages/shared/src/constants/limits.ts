// ─── Plan Limit Definitions ──────────────────────────────────
// These are the SOURCE OF TRUTH for plan limits.
// They are seeded into the database and cached in Redis.

export interface PlanLimits {
  name: string;
  maxLeadsMonthly: number;
  maxJobsMonthly: number;
  maxPagesPerJob: number;
  maxConcurrentJobs: number;
  maxExportsMonthly: number;
  llmEnabled: boolean;
  maxLlmTokensMonthly: number;
  apiRateLimitRpm: number;
  dataRetentionDays: number;
  priceMonthyCents: number;
}

export const PLAN_LIMITS: Record<string, PlanLimits> = {
  free: {
    name: 'Free',
    maxLeadsMonthly: 500,
    maxJobsMonthly: 5,
    maxPagesPerJob: 100,
    maxConcurrentJobs: 1,
    maxExportsMonthly: 3,
    llmEnabled: false,
    maxLlmTokensMonthly: 0,
    apiRateLimitRpm: 30,
    dataRetentionDays: 30,
    priceMonthyCents: 0,
  },
  pro: {
    name: 'Pro',
    maxLeadsMonthly: 10_000,
    maxJobsMonthly: 50,
    maxPagesPerJob: 5_000,
    maxConcurrentJobs: 3,
    maxExportsMonthly: 999_999, // effectively unlimited
    llmEnabled: true,
    maxLlmTokensMonthly: 500_000,
    apiRateLimitRpm: 120,
    dataRetentionDays: 90,
    priceMonthyCents: 2900, // $29/mo
  },
  enterprise: {
    name: 'Enterprise',
    maxLeadsMonthly: 999_999,
    maxJobsMonthly: 999_999,
    maxPagesPerJob: 10_000,
    maxConcurrentJobs: 10,
    maxExportsMonthly: 999_999,
    llmEnabled: true,
    maxLlmTokensMonthly: 5_000_000,
    apiRateLimitRpm: 600,
    dataRetentionDays: 365,
    priceMonthyCents: 9900, // $99/mo
  },
} as const;

// ─── Limit Types ─────────────────────────────────────────────
export type LimitType =
  | 'leads_monthly'
  | 'jobs_monthly'
  | 'pages_per_job'
  | 'concurrent_jobs'
  | 'exports_monthly'
  | 'llm_tokens_monthly'
  | 'api_rate';

// ─── Crawl delay presets (milliseconds between requests) ─────
export const CRAWL_DELAYS = {
  polite: 2000,    // 2 seconds — safest, robots.txt friendly
  normal: 1000,    // 1 second — default
  aggressive: 300, // 300ms — only for sites with explicit permission
} as const;

// ─── Extraction methods ──────────────────────────────────────
export const EXTRACTION_METHODS = ['script', 'llm', 'hybrid'] as const;
export type ExtractionMethod = (typeof EXTRACTION_METHODS)[number];

// ─── Quality score thresholds ────────────────────────────────
export const QUALITY_THRESHOLDS = {
  minimum: 20,   // Below this → discard
  low: 40,       // Below this → needs review
  acceptable: 60, // Standard quality
  good: 80,       // High quality
} as const;

// ─── Page limits ─────────────────────────────────────────────
export const MAX_PAGINATION_PAGES = 10_000;
export const DEFAULT_PAGE_TIMEOUT_MS = 30_000;
export const DEFAULT_NAVIGATION_TIMEOUT_MS = 60_000;