/**
 * Page Fetcher — Two-tier fetching strategy.
 *
 * Tier 1: Simple HTTP (fast, cheap) — for static HTML pages
 * Tier 2: Playwright (slower, robust) — for JS-rendered / interactive pages
 */

import type { Browser, Page, BrowserContext } from 'playwright';
import { CRAWL_DELAYS } from '@leadfetcher/shared';

let _browser: Browser | null = null;

/**
 * Simple HTTP fetch — tries this first, falls back to Playwright if content is empty
 */
export async function fetchWithHTTP(url: string): Promise<{ html: string; success: boolean }> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate',
        'Cache-Control': 'no-cache',
      },
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      return { html: '', success: false };
    }

    const html = await response.text();

    // Check if content is actually rendered (not just a shell)
    if (html.length < 500 || html.includes('__NEXT_DATA__') && !html.includes('<main')) {
      // Likely needs JS rendering
      return { html, success: false };
    }

    return { html, success: true };
  } catch {
    return { html: '', success: false };
  }
}

/**
 * Fetch with Playwright — for JS-heavy sites
 */
export async function fetchWithPlaywright(
  url: string,
  options: {
    clickPhoneReveal?: string; // CSS selector for "show phone" button
    waitForSelector?: string;  // Wait for this element before extracting
    scrollToBottom?: boolean;
  } = {},
): Promise<{ html: string; success: boolean }> {
  const browser = await getBrowser();
  let context: BrowserContext | null = null;

  try {
    context = await browser.newContext({
      userAgent: getRandomUserAgent(),
      viewport: getRandomViewport(),
      locale: 'en-US',
      timezoneId: 'America/New_York',
    });

    const page = await context.newPage();

    // Block unnecessary resources for speed
    await page.route('**/*.{png,jpg,jpeg,gif,svg,woff,woff2,ttf,eot,mp4,webm}', route => route.abort());

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });

    // Wait for specific selector if provided
    if (options.waitForSelector) {
      await page.waitForSelector(options.waitForSelector, { timeout: 10_000 }).catch(() => { });
    }

    // Scroll to bottom to trigger lazy loading
    if (options.scrollToBottom) {
      await autoScroll(page);
    }

    // Click phone reveal button if provided
    if (options.clickPhoneReveal) {
      const buttons = await page.$$(options.clickPhoneReveal);
      for (const btn of buttons) {
        await btn.click().catch(() => { });
        await page.waitForTimeout(500);
      }
    }

    const html = await page.content();
    return { html, success: html.length > 500 };
  } catch {
    return { html: '', success: false };
  } finally {
    await context?.close();
  }
}

/**
 * Smart fetch — tries HTTP first, falls back to Playwright
 */
export async function smartFetch(
  url: string,
  requiresJs: boolean = false,
  options: { clickPhoneReveal?: string; waitForSelector?: string; scrollToBottom?: boolean } = {},
): Promise<{ html: string; method: 'http' | 'playwright' }> {
  if (!requiresJs) {
    const httpResult = await fetchWithHTTP(url);
    if (httpResult.success) {
      return { html: httpResult.html, method: 'http' };
    }
  }

  const playwrightResult = await fetchWithPlaywright(url, options);
  return { html: playwrightResult.html, method: 'playwright' };
}

/**
 * Get crawl delay in ms for a given preset
 */
export function getCrawlDelay(preset: 'polite' | 'normal' | 'aggressive' = 'normal'): number {
  return CRAWL_DELAYS[preset] || 1000;
}

/**
 * Sleep helper
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Auto-scroll page to trigger lazy loading
 */
async function autoScroll(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let totalHeight = 0;
      const distance = 400;
      const timer = setInterval(() => {
        const scrollHeight = (globalThis as any).document.body.scrollHeight;
        (globalThis as any).scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 200);
    });
  });
}

/**
 * Get or create browser instance (singleton)
 */
async function getBrowser(): Promise<Browser> {
  if (!_browser) {
    const { chromium } = await import('playwright');
    _browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
  }
  return _browser;
}

/**
 * Close browser instance
 */
export async function closeBrowser(): Promise<void> {
  if (_browser) {
    await _browser.close();
    _browser = null;
  }
}

/**
 * Random user agent to avoid fingerprinting
 */
export function getRandomUserAgent(): string {
  const agents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  ];
  return agents[Math.floor(Math.random() * agents.length)]!;
}

/**
 * Random viewport to avoid fingerprinting
 */
export function getRandomViewport(): { width: number; height: number } {
  const viewports = [
    { width: 1920, height: 1080 },
    { width: 1366, height: 768 },
    { width: 1536, height: 864 },
    { width: 1440, height: 900 },
  ];
  return viewports[Math.floor(Math.random() * viewports.length)]!;
}