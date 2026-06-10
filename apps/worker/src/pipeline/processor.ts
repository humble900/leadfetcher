/**
 * Processing Pipeline — Validates, deduplicates, normalizes, and scores leads.
 *
 * All script-based, no LLM needed. Runs after extraction.
 */

import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';
import type { ExtractedLead } from '@leadfetcher/shared';

/**
 * Normalize a lead — clean up phone numbers, emails, trim whitespace
 */
export function normalizeLead(lead: ExtractedLead): ExtractedLead {
  return {
    ...lead,
    vendorName: lead.vendorName?.trim().replace(/\s+/g, ' ') || null,
    email: lead.email?.toLowerCase().trim() || null,
    phone: normalizePhone(lead.phone),
    whatsapp: normalizePhone(lead.whatsapp),
    website: normalizeUrl(lead.website),
    location: lead.location?.trim().replace(/\s+/g, ' ') || null,
    businessCategory: lead.businessCategory?.trim() || null,
    productName: lead.productName?.trim() || null,
    price: lead.price?.trim() || null,
    description: lead.description?.trim().slice(0, 1000) || null,
    listingUrl: lead.listingUrl,
  };
}

/**
 * Check if a lead is a duplicate of existing leads
 */
export function isDuplicate(
  lead: ExtractedLead,
  existingLeads: Array<{ email?: string | null; phone?: string | null; vendorName?: string | null }>,
): boolean {
  for (const existing of existingLeads) {
    // Exact email match
    if (lead.email && existing.email && lead.email.toLowerCase() === existing.email.toLowerCase()) {
      return true;
    }
    // Exact phone match
    if (lead.phone && existing.phone && normalizePhone(lead.phone) === normalizePhone(existing.phone)) {
      return true;
    }
    // Very similar vendor name
    if (lead.vendorName && existing.vendorName && similarityScore(lead.vendorName, existing.vendorName) > 0.9) {
      return true;
    }
  }
  return false;
}

/**
 * Score a lead's quality (0-100)
 */
export function scoreLead(lead: ExtractedLead): number {
  let score = 0;

  // Contact info (most valuable)
  if (lead.email) score += 25;
  if (lead.phone) score += 25;
  if (lead.whatsapp) score += 10;

  // Business info
  if (lead.vendorName) score += 15;
  if (lead.location) score += 10;
  if (lead.businessCategory) score += 5;
  if (lead.website) score += 5;
  if (lead.description && lead.description.length > 50) score += 5;

  return Math.min(score, 100);
}

/**
 * Normalize phone number to E.164 format
 */
function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/[\s.-]/g, '');
  try {
    if (isValidPhoneNumber(cleaned, 'NG')) {
      return parsePhoneNumber(cleaned, 'NG')!.format('E.164');
    }
    if (isValidPhoneNumber(cleaned)) {
      return parsePhoneNumber(cleaned)!.format('E.164');
    }
  } catch {
    // Return cleaned version
  }
  return cleaned.length >= 7 ? cleaned : null;
}

/**
 * Normalize URL
 */
function normalizeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    return u.href;
  } catch {
    return null;
  }
}

/**
 * Simple string similarity (Jaccard on character bigrams)
 */
function similarityScore(a: string, b: string): number {
  const bigramsA = new Set<string>();
  const bigramsB = new Set<string>();
  const la = a.toLowerCase();
  const lb = b.toLowerCase();

  for (let i = 0; i < la.length - 1; i++) bigramsA.add(la.slice(i, i + 2));
  for (let i = 0; i < lb.length - 1; i++) bigramsB.add(lb.slice(i, i + 2));

  let intersection = 0;
  for (const bg of bigramsA) {
    if (bigramsB.has(bg)) intersection++;
  }

  const union = bigramsA.size + bigramsB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}