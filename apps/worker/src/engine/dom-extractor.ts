/**
 * DOM Extractor — Uses Cheerio CSS selectors to extract structured data from HTML.
 *
 * This is the second layer of the script-based extraction:
 * 1. Known sites → use site profile selectors
 * 2. Unknown sites → use generic heuristic selectors
 */

import * as cheerio from 'cheerio';
import type { SiteProfile, ExtractedLead } from '@leadfetcher/shared';

/**
 * Extract listing cards from a directory/listing page
 */
export function extractListingCards(
  html: string,
  pageUrl: string,
  siteProfile: SiteProfile | null,
): ExtractedLead[] {
  const $ = cheerio.load(html);
  const leads: ExtractedLead[] = [];

  // Strategy 1: Use site profile selectors if available
  if (siteProfile?.selectors?.cardContainer) {
    $(siteProfile.selectors.cardContainer).each((_i, el) => {
      const card = $(el);
      const lead = extractFromCard($, card, siteProfile, pageUrl);
      if (lead && hasMinimumData(lead)) {
        leads.push(lead);
      }
    });
    return leads;
  }

  // Strategy 2: Generic heuristic — look for repeating card patterns
  const cardSelectors = [
    '.listing-card', '.vendor-card', '.business-card', '.result-card',
    '.card', '[class*="listing"]', '[class*="vendor"]', '[class*="result"]',
    'article', '.item', '.entry',
  ];

  for (const selector of cardSelectors) {
    const cards = $(selector);
    if (cards.length >= 3) { // At least 3 cards = likely a listing
      cards.each((_i, el) => {
        const card = $(el);
        const lead = extractFromCardGeneric($, card, pageUrl);
        if (lead && hasMinimumData(lead)) {
          leads.push(lead);
        }
      });
      if (leads.length > 0) break;
    }
  }

  return leads;
}

/**
 * Extract data from a card using site profile selectors
 */
function extractFromCard(
  $: cheerio.CheerioAPI,
  card: cheerio.Cheerio<any>,
  profile: SiteProfile,
  pageUrl: string,
): ExtractedLead | null {
  const s = profile.selectors;
  return {
    vendorName: s.vendorName ? card.find(s.vendorName).first().text().trim() || null : null,
    email: s.email ? card.find(s.email).first().text().trim() || null : null,
    phone: s.phone ? card.find(s.phone).first().text().trim() || null : null,
    location: s.location ? card.find(s.location).first().text().trim() || null : null,
    businessCategory: s.businessCategory ? card.find(s.businessCategory).first().text().trim() || null : null,
    listingUrl: card.find('a').first().attr('href') ? new URL(card.find('a').first().attr('href')!, pageUrl).href : pageUrl,
  };
}

/**
 * Extract data from a card using generic heuristics
 */
function extractFromCardGeneric(
  $: cheerio.CheerioAPI,
  card: cheerio.Cheerio<any>,
  pageUrl: string,
): ExtractedLead | null {
  const text = card.text();
  const link = card.find('a').first().attr('href');

  return {
    vendorName: card.find('h2, h3, h4, [class*="name"], [class*="title"]').first().text().trim() || null,
    email: extractEmailFromText(text),
    phone: extractPhoneFromText(text),
    location: card.find('[class*="location"], [class*="address"], address').first().text().trim() || null,
    businessCategory: card.find('[class*="category"], [class*="type"]').first().text().trim() || null,
    listingUrl: link ? new URL(link, pageUrl).href : pageUrl,
  };
}

/**
 * Check if a page looks like a listing/directory page
 */
export function isListingPage(html: string): boolean {
  const $ = cheerio.load(html);
  const cardSelectors = ['.card', 'article', '[class*="listing"]', '[class*="result"]', '.item'];
  for (const sel of cardSelectors) {
    if ($(sel).length >= 3) return true;
  }
  return false;
}

function extractEmailFromText(text: string): string | null {
  const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return match ? match[0] : null;
}

function extractPhoneFromText(text: string): string | null {
  const match = text.match(/(?:\+?\d{1,4}[\s-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/);
  return match ? match[0].trim() : null;
}

function hasMinimumData(lead: ExtractedLead): boolean {
  return !!(lead.vendorName || lead.email || lead.phone);
}