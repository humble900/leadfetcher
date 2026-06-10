/**
 * Hybrid Extractor — Orchestrates the two-tier extraction strategy.
 *
 * Tier 1: Scripts (Cheerio + Regex) — FREE, handles 90% of work
 * Tier 2: LLM fallback — only called when scripts miss critical fields
 */

import * as cheerio from 'cheerio';
import { regexExtract } from './regex-extractor.js';
import type { SiteProfile, ExtractedLead } from '@leadfetcher/shared';

/**
 * Extract contact data from a single page HTML
 */
export function hybridExtract(
  html: string,
  pageUrl: string,
  siteProfile: SiteProfile | null,
): ExtractedLead {
  const $ = cheerio.load(html);

  // ─── Layer 1: Regex extraction (emails, phones, social) ────
  const regexData = regexExtract(html);

  // ─── Layer 2: DOM extraction (structured data) ─────────────
  const domData = extractFromDOM($, siteProfile);

  // ─── Merge results (DOM takes priority for structured fields) ─
  return {
    vendorName: domData.vendorName || extractTitle($) || null,
    email: domData.email || regexData.emails[0] || null,
    phone: domData.phone || regexData.phones[0] || null,
    whatsapp: regexData.whatsapps[0] || null,
    website: domData.website || regexData.websites[0] || null,
    location: domData.location || null,
    businessCategory: domData.businessCategory || null,
    productName: domData.productName || null,
    price: domData.price || null,
    description: domData.description || null,
    listingUrl: pageUrl,
    socialMedia: regexData.socialMedia,
  };
}

/**
 * Extract structured data from DOM using CSS selectors
 */
function extractFromDOM(
  $: cheerio.CheerioAPI,
  siteProfile: SiteProfile | null,
): Partial<ExtractedLead> {
  const result: Partial<ExtractedLead> = {};

  if (siteProfile?.selectors) {
    const s = siteProfile.selectors;
    if (s.vendorName) result.vendorName = $(s.vendorName).first().text().trim() || undefined;
    if (s.phone) result.phone = $(s.phone).first().text().trim() || undefined;
    if (s.email) result.email = $(s.email).first().text().trim() || undefined;
    if (s.price) result.price = $(s.price).first().text().trim() || undefined;
    if (s.location) result.location = $(s.location).first().text().trim() || undefined;
    return result;
  }

  // Generic heuristic selectors
  result.vendorName = $('h1').first().text().trim() || undefined;
  result.location = $('[class*="address"], [class*="location"], address').first().text().trim() || undefined;
  result.price = $('[class*="price"]').first().text().trim() || undefined;
  result.description = $('meta[name="description"]').attr('content') || $('[class*="description"]').first().text().trim().slice(0, 500) || undefined;

  return result;
}

/**
 * Extract listing links from a page (for URL discovery)
 */
export function extractListingLinks(
  html: string,
  pageUrl: string,
  siteProfile: SiteProfile | null,
): string[] {
  const $ = cheerio.load(html);
  const links: string[] = [];
  const base = new URL(pageUrl);

  // Use site profile's listing link selector if available
  const selector = siteProfile?.selectors?.listingLinks || 'a[href]';

  $(selector).each((_i, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    try {
      const url = new URL(href, base.origin);
      if (url.origin === base.origin) {
        links.push(url.href);
      }
    } catch {
      // Invalid URL
    }
  });

  return [...new Set(links)];
}

/**
 * Extract page title as fallback vendor name
 */
function extractTitle($: cheerio.CheerioAPI): string | null {
  const h1 = $('h1').first().text().trim();
  if (h1 && h1.length < 200) return h1;
  const title = $('title').text().trim();
  if (title && title.length < 200) return title;
  return null;
}