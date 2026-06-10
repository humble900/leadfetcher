import { z } from 'zod';

// ─── Lead Schema ─────────────────────────────────────────────
export const LeadSchema = z.object({
  id: z.string().uuid().optional(),
  tenantId: z.string().uuid(),
  jobId: z.string().uuid(),
  vendorName: z.string().max(500).nullable().optional(),
  email: z.string().email().max(255).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  whatsapp: z.string().max(50).nullable().optional(),
  website: z.string().url().nullable().optional(),
  location: z.string().max(500).nullable().optional(),
  businessCategory: z.string().max(255).nullable().optional(),
  productName: z.string().max(500).nullable().optional(),
  price: z.string().max(100).nullable().optional(),
  description: z.string().nullable().optional(),
  listingUrl: z.string().url(),
  socialMedia: z.record(z.string()).default({}),
  additionalInfo: z.record(z.string()).default({}),
  qualityScore: z.number().int().min(0).max(100).default(0),
  extractionMethod: z.enum(['script', 'llm', 'hybrid']).default('script'),
  isVerified: z.boolean().default(false),
  isDuplicate: z.boolean().default(false),
});

export type Lead = z.infer<typeof LeadSchema>;

// Schema for creating a lead (no id, tenantId injected server-side)
export const CreateLeadSchema = LeadSchema.omit({
  id: true,
  tenantId: true,
});

export type CreateLead = z.infer<typeof CreateLeadSchema>;

// ─── Lead extracted from a page (before storage) ────────────
export const ExtractedLeadSchema = z.object({
  vendorName: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  whatsapp: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  businessCategory: z.string().nullable().optional(),
  productName: z.string().nullable().optional(),
  price: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  listingUrl: z.string(),
  socialMedia: z.record(z.string()).optional(),
  additionalInfo: z.record(z.string()).optional(),
});

export type ExtractedLead = z.infer<typeof ExtractedLeadSchema>;

// ─── LLM Extraction Schema (for LLM fallback) ───────────────
export const LLMExtractionSchema = z.object({
  leads: z.array(ExtractedLeadSchema),
  confidence: z.number().min(0).max(1).default(0.5),
  tokensUsed: z.number().int().default(0),
});

export type LLMExtraction = z.infer<typeof LLMExtractionSchema>;

// ─── Lead Query Schema (for filtering/searching) ────────────
export const LeadQuerySchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  jobId: z.string().uuid().optional(),
  search: z.string().optional(),
  hasEmail: z.boolean().optional(),
  hasPhone: z.boolean().optional(),
  isVerified: z.boolean().optional(),
  minQualityScore: z.number().int().min(0).max(100).optional(),
  businessCategory: z.string().optional(),
  sortBy: z.enum(['createdAt', 'qualityScore', 'vendorName']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type LeadQuery = z.infer<typeof LeadQuerySchema>;