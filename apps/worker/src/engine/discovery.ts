/**
 * URL Discovery — finds all listing page URLs on a marketplace.
 *
 * Strategy hierarchy:
 * 1. Parse sitemap.xml (fastest, most complete)
 * 2. Intercept API calls (for SPA sites)
 * 3. Crawl HTML listing pages and follow links
 */

import { extractListingLinks } from './extractor.js';
import { smartFetch } from './fetcher.js';
import type { SiteProfile } from '@leadfetcher/shared';

export interface DiscoveryResult {
  listingUrls: string[];
  paginationUrls: string[];
  method: 'sitemap' | 'html_crawl';
  totalFound: number;
}

/**
 * Discover listing URLs from a target marketplace
 */
export async function discoverUrls(
  targetUrl: string,
  siteProfile: SiteProfile | null,
  maxPages: number = 100,
): Promise<DiscoveryResult> {
  const baseUrl = new URL(targetUrl);
  const domain = baseUrl.origin;

  // ─── Try Sitemap First ─────────────────────────────────────
  const sitemapUrls = await trySitemap(domain);
  if (sitemapUrls.length > 0) {
    return {
      listingUrls: sitemapUrls.slice(0, maxPages),
      paginationUrls: [],
      method: 'sitemap',
      totalFound: sitemapUrls.length,
    };
  }

  // ─── Fallback: HTML Crawl ──────────────────────────────────
  const { html } = await smartFetch(targetUrl, siteProfile?.requiresJs || false);
  const links = extractListingLinks(html, targetUrl, siteProfile);

  // Filter: only same-domain links, deduplicate
  const seen = new Set<string>();
  const listingUrls: string[] = [];

  for (const link of links) {
    try {
      const url = new URL(link, domain);
      // Only same domain
      if (url.origin !== domain) continue;
      // Skip obvious non-listing pages
      if (isNavigationUrl(url.pathname)) continue;

      const normalized = url.origin + url.pathname;
      if (!seen.has(normalized)) {
        seen.add(normalized);
        listingUrls.push(normalized);
      }
    } catch {
      // Invalid URL, skip
    }
  }

  return {
    listingUrls: listingUrls.slice(0, maxPages),
    paginationUrls: detectPaginationUrls(html, targetUrl, siteProfile),
    method: 'html_crawl',
    totalFound: listingUrls.length,
  };
}

/**
 * Detect pagination URLs from the current page
 */
export function detectPaginationUrls(
  html: string,
  currentUrl: string,
  siteProfile: SiteProfile | null,
): string[] {
  const urls: string[] = [];
  const baseUrl = new URL(currentUrl);

  // Strategy 1: Look for explicit next/pagination links
  const paginationPatterns = [
    /href=["']([^"']*[?&]page=\d+[^"']*)["']/gi,
    /href=["']([^"']*\/page\/\d+[^"']*)["']/gi,
    /href=["']([^"']*[?&]p=\d+[^"']*)["']/gi,
    /href=["']([^"']*[?&]offset=\d+[^"']*)["']/gi,
  ];

  for (const pattern of paginationPatterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      try {
        const url = new URL(match[1]!, baseUrl.origin);
        if (url.origin === baseUrl.origin) {
          urls.push(url.href);
        }
      } catch {
        // Skip invalid URLs
      }
    }
  }

  return [...new Set(urls)];
}

/**
 * Try to parse sitemap.xml for URLs
 */
async function trySitemap(domain: string): Promise<string[]> {
  try {
    const sitemapUrl = `${domain}/sitemap.xml`;
    const response = await fetch(sitemapUrl, {
      headers: { 'User-Agent': 'LeadFetcher/1.0' },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) return [];

    const xml = await response.text();
    const urls: string[] = [];

    // Simple XML parsing for <loc> elements
    const locPattern = /<loc>\s*(https?:\/\/[^<]+)\s*<\/loc>/gi;
    let match;
    while ((match = locPattern.exec(xml)) !== null) {
      urls.push(match[1]!);
    }

    return urls;
  } catch {
    return [];
  }
}

/**
 * Check if a URL is a navigation/utility page (not a listing)
 */
function isNavigationUrl(pathname: string): boolean {
  const skipPatterns = [
    /^\/?$/, // homepage
    /\/(login|register|signup|signin|auth|account|cart|checkout)/i,
    /\/(about|contact|privacy|terms|faq|help|support)/i,
    /\/(admin|dashboard|settings|profile)/i,
    /\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/i,
    /\/#/,
  ];
  return skipPatterns.some(p => p.test(pathname));
}