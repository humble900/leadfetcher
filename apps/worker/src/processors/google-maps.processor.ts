/**
 * Google Maps Scraper Processor — Production-grade scraping with stealth,
 * proxy rotation, retry logic, rate limiting, and leads quota enforcement.
 */
import { eq, and, or } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { Redis } from 'ioredis';
import pino from 'pino';
import * as schema from './db-schema.js';
import { crawlCompanyWebsite } from './prospector.processor.js';
import { normalizeLead, scoreLead } from '../pipeline/processor.js';
import { sleep, getCrawlDelay, getRandomUserAgent, getRandomViewport } from '../engine/fetcher.js';
import { getNextProxy, reportProxyResult } from '../engine/proxy-rotator.js';
import { JobContext } from './job.processor.js';
const { Pool } = pg;
const logger = pino({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    transport: process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
});
/**
 * Launch a stealth-enabled browser with rotating proxy support
 */
async function launchStealthBrowser(onActivity: any) {
    // Get next proxy from the rotation pool
    const proxy = await getNextProxy();
    if (proxy) {
        onActivity?.('proxy', `Using proxy: ${proxy.server.replace(/\/\/.*@/, '//***@')}`);
    }
    // Try playwright-extra with stealth plugin first
    try {
        const { chromium: stealthChromium } = await import('playwright-extra');
        const StealthPlugin = (await import('puppeteer-extra-plugin-stealth')).default;
        stealthChromium.use(StealthPlugin());
        const launchOptions: any = {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-blink-features=AutomationControlled',
                '--disable-features=IsolateOrigins,site-per-process',
            ],
        };
        if (proxy) {
            launchOptions.proxy = proxy;
        }
        const browser = await stealthChromium.launch(launchOptions);
        return { browser, proxyServer: proxy?.server };
    }
    catch (err) {
        // Fallback to regular playwright if stealth fails
        logger.warn('playwright-extra stealth unavailable, falling back to regular chromium');
        const { chromium } = await import('playwright');
        const launchOptions: any = {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-blink-features=AutomationControlled',
            ],
        };
        if (proxy) {
            launchOptions.proxy = proxy;
        }
        const browser = await chromium.launch(launchOptions);
        return { browser, proxyServer: proxy?.server };
    }
}
/**
 * Navigate to a URL with retry logic
 */
async function navigateWithRetry(page: any, url: string, options: { timeout?: number; retries?: number } = { timeout: 30000, retries: 2 }) {
    for (let attempt = 0; attempt <= (options.retries || 1); attempt++) {
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: options.timeout });
            return true;
        }
        catch (err) {
            if (attempt < (options.retries || 1)) {
                const backoff = 2000 * (attempt + 1);
                logger.warn({ url, attempt, backoff }, 'Navigation failed, retrying...');
                await sleep(backoff);
            }
        }
    }
    return false;
}
/**
 * Get a randomized delay based on crawl delay preset with jitter
 */
function getJitteredDelay(preset: 'polite' | 'normal' | 'aggressive' = 'normal') {
    const base = getCrawlDelay(preset);
    const jitter = base * 0.3; // +/- 30%
    return base + (Math.random() * 2 - 1) * jitter;
}
/**
 * Process a Google Maps Scraper job
 */
export async function processGoogleMapsJob(ctx: JobContext) {
    const pool = new Pool({ connectionString: ctx.databaseUrl });
    const db = drizzle(pool, { schema });
    const redis = new Redis(ctx.redisUrl, {
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
    });
    redis.on('error', () => {}); // Suppress connection error crashes
    const progress = {
        pagesFound: 0,
        pagesCrawled: 0,
        leadsFound: 0,
        leadsStored: 0,
        errors: 0,
    };
    let browser;
    let context;
    let proxyServer;
    try {
        // 1. Mark job as running
        await db.update(schema.jobs)
            .set({ status: 'running', startedAt: new Date(), progress: progress })
            .where(eq(schema.jobs.id, ctx.jobId));
        ctx.onActivity?.('orchestrator', `Starting Google Maps Scraper. Search URL / query: ${ctx.targetUrl}`);
        // Determine target search URL
        let searchUrl = ctx.targetUrl;
        if (!searchUrl.startsWith('http')) {
            searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(searchUrl)}`;
        }
        // 2. Launch stealth browser with anti-detection and proxy rotation
        ctx.onActivity?.('google_maps', 'Launching stealth browser with anti-detection...');
        const launchResult = await launchStealthBrowser(ctx.onActivity);
        browser = launchResult.browser;
        proxyServer = launchResult.proxyServer;
        const viewport = getRandomViewport();
        context = await browser.newContext({
            userAgent: getRandomUserAgent(),
            viewport,
            locale: 'en-US',
            timezoneId: 'America/New_York',
            geolocation: undefined,
            permissions: [],
        });
        const page = await context.newPage();
        // Block unnecessary resources for speed and stealth
        await page.route('**/*.{png,jpg,jpeg,gif,svg,woff,woff2,ttf,eot,mp4,webm,ico}', (route) => route.abort());
        await page.route('**/{analytics,tracking,ads,doubleclick,googlesyndication}**', (route) => route.abort());
        ctx.onActivity?.('google_maps', `Navigating to Google Maps: ${searchUrl}`);
        const navSuccess = await navigateWithRetry(page, searchUrl);
        if (!navSuccess) {
            throw new Error(`Failed to load Google Maps search page after retries: ${searchUrl}`);
        }
        // Handle cookie consent
        try {
            const consentSelector = 'form[action*="consent.google.com"] button, button[aria-label="Accept all"], button[aria-label="Agree"]';
            if (await page.locator(consentSelector).first().isVisible({ timeout: 5000 })) {
                ctx.onActivity?.('google_maps', 'Accepting Google cookie consent...');
                await page.locator(consentSelector).first().click();
                await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => { });
            }
        }
        catch {
            // ignore consent dialog error
        }
        const maxPlaces = Math.min(ctx.config.maxPages || 120, ctx.planLimits.maxPagesPerJob);
        const crawlDelay = ctx.config.crawlDelay || 'normal';
        const urls = new Set<string>();
        // Usage limit tracking
        const periodKey = new Date().toISOString().slice(0, 7);
        const limitKey = `limit:leads_monthly:${ctx.tenantId}:${periodKey}`;
        // Check if redirected to a single place page
        const initialUrl = page.url();
        if (initialUrl.includes('/maps/place/')) {
            ctx.onActivity?.('google_maps', 'Directly redirected to a single place page');
            urls.add(initialUrl);
        }
        else {
            // Wait for results to load
            ctx.onActivity?.('google_maps', 'Waiting for results list to load...');
            try {
                await page.waitForSelector('a[href*="/maps/place/"]', { timeout: 15000 });
            }
            catch {
                ctx.onActivity?.('google_maps', 'No results found or page load timed out.');
            }
            const feedSelector = 'div[role="feed"]';
            let lastHeight = 0;
            let scrollAttempts = 0;
            while (urls.size < maxPlaces) {
                // Check cancellation
                const [currentJob] = await db.select().from(schema.jobs).where(eq(schema.jobs.id, ctx.jobId)).limit(1);
                if (currentJob?.status === 'cancelled') {
                    ctx.onActivity?.('orchestrator', 'Google Maps Scraper Job cancelled by user.');
                    return;
                }
                // Collect place URLs
                const pageUrls = await page.evaluate(() => {
                    const doc = (globalThis as any).document;
                    const links = doc.querySelectorAll('a[href*="/maps/place/"]');
                    const hrefs = [];
                    for (let i = 0; i < links.length; i++) {
                        const href = links[i].getAttribute('href');
                        if (href) hrefs.push(href);
                    }
                    return hrefs;
                });
                const prevSize = urls.size;
                for (const url of pageUrls) {
                    if (urls.size < maxPlaces)
                        urls.add(url);
                }
                if (urls.size !== prevSize) {
                    progress.pagesFound = urls.size;
                    await db.update(schema.jobs).set({ progress: progress }).where(eq(schema.jobs.id, ctx.jobId));
                    ctx.onProgress?.(progress);
                }
                // Scroll the feed
                const feedExists = await page.$(feedSelector);
                if (!feedExists) {
                    ctx.onActivity?.('google_maps', 'No scrollable feed found; parsing direct results.');
                    break;
                }
                const height = await page.evaluate((sel) => {
                    const doc = (globalThis as any).document;
                    const el = doc.querySelector(sel);
                    if (el) {
                        el.scrollBy(0, el.scrollHeight);
                        return el.scrollHeight;
                    }
                    return 0;
                }, feedSelector);
                // Check end-of-list markers
                const reachedEnd = await page.evaluate(() => {
                    const doc = (globalThis as any).document;
                    const texts = ["You've reached the end of the list", 'End of list', 'No more results'];
                    const elements = doc.querySelectorAll('span, div, p');
                    for (let i = 0; i < elements.length; i++) {
                        const txt = elements[i].textContent || '';
                        for (let j = 0; j < texts.length; j++) {
                            if (txt.includes(texts[j])) {
                                return true;
                            }
                        }
                    }
                    return false;
                });
                if (reachedEnd) {
                    ctx.onActivity?.('google_maps', 'Reached end of search results list.');
                    break;
                }
                if (height === lastHeight) {
                    scrollAttempts++;
                    if (scrollAttempts >= 10) {
                        ctx.onActivity?.('google_maps', 'Scrolling completed — no new results loading.');
                        break;
                    }
                }
                else {
                    scrollAttempts = 0;
                }
                lastHeight = height;
                await page.waitForTimeout(1500);
            }
        }
        ctx.onActivity?.('google_maps', `Found ${urls.size} businesses. Extracting details...`);
        const placeUrls = Array.from(urls);
        const storedLeadKeys = new Set(); // Memory-efficient dedup keys
        for (let i = 0; i < placeUrls.length; i++) {
            const url = placeUrls[i];
            progress.pagesCrawled = i + 1;
            // Check cancellation
            if (i % 5 === 0) {
                const [currentJob] = await db.select().from(schema.jobs).where(eq(schema.jobs.id, ctx.jobId)).limit(1);
                if (currentJob?.status === 'cancelled') {
                    ctx.onActivity?.('orchestrator', 'Google Maps Scraper Job cancelled by user.');
                    return;
                }
            }
            // Check monthly leads quota BEFORE processing
            let paidMode = 'false';
            try {
                paidMode = await redis.get('admin:settings:paid_mode') || 'false';
            } catch (err) {
                // Redis is offline, fallback to 'false' (free/unlimited mode)
            }
            if (paidMode === 'true') {
                try {
                    const currentUsage = await redis.get(limitKey);
                    if (currentUsage && parseInt(currentUsage) >= ctx.planLimits.maxLeadsMonthly) {
                        ctx.onActivity?.('orchestrator', `Monthly leads limit reached (${ctx.planLimits.maxLeadsMonthly}). Stopping job.`);
                        break;
                    }
                } catch (err) {
                    // Fail-safe: if usage cannot be verified, continue
                }
            }
            try {
                ctx.onActivity?.('google_maps', `Extracting ${i + 1}/${placeUrls.length}: ${url}`);
                const navOk = await navigateWithRetry(page, url, { timeout: 30000, retries: 1 });
                if (!navOk) {
                    progress.errors++;
                    ctx.onActivity?.('google_maps', `Failed to load place page after retries: ${url}`);
                    continue;
                }
                // Wait for the h1 title to confirm page loaded
                await page.waitForSelector('h1', { timeout: 10000 }).catch(() => { });
                // Extract place details using resilient selectors
                const data = await page.evaluate(() => {
                    const doc = (globalThis as any).document;
                    // Business Name — h1 is always the business name
                    const name = doc.querySelector('h1')?.textContent?.trim() || null;
                    // Address — use data-item-id="address" (stable) with aria fallback
                    const addressBtn = doc.querySelector('button[data-item-id="address"]')
                        || doc.querySelector('[data-tooltip="Copy address"]')?.closest('button');
                    const address = addressBtn?.textContent?.trim() || null;
                    // Phone — use data-item-id that starts with "phone:tel:" (stable)
                    const phoneBtn = doc.querySelector('button[data-item-id^="phone:tel:"]')
                        || doc.querySelector('[data-tooltip="Copy phone number"]')?.closest('button');
                    let phone = null;
                    if (phoneBtn) {
                        const dataId = phoneBtn.getAttribute('data-item-id') || '';
                        phone = dataId.startsWith('phone:tel:') ? dataId.replace('phone:tel:', '') : (phoneBtn.textContent?.trim() || null);
                    }
                    // Website — data-item-id="authority" link (stable)
                    const websiteBtn = doc.querySelector('a[data-item-id="authority"]');
                    const website = websiteBtn ? websiteBtn.href : null;
                    // Rating & Reviews — use aria-label on the rating element (more stable than class names)
                    let rating = null;
                    let reviewCount = null;
                    // Try aria-based detection first
                    const ratingEl = doc.querySelector('[role="img"][aria-label*="stars"]')
                        || doc.querySelector('[aria-label*="rating"]');
                    if (ratingEl) {
                        const ariaLabel = ratingEl.getAttribute('aria-label') || '';
                        const ratingMatch = ariaLabel.match(/([\d.]+)\s*star/i);
                        if (ratingMatch)
                            rating = parseFloat(ratingMatch[1]);
                        const reviewMatch = ariaLabel.match(/([\d,]+)\s*review/i);
                        if (reviewMatch)
                            reviewCount = parseInt(reviewMatch[1].replace(/,/g, ''));
                    }
                    // Fallback to known containers if aria didn't work
                    if (!rating) {
                        const ratingContainer = doc.querySelector('.F7nice, .fontDisplayLarge, [class*="rating"]');
                        if (ratingContainer) {
                            const ratingSpan = ratingContainer.querySelector('span[aria-hidden="true"]');
                            if (ratingSpan)
                                rating = parseFloat(ratingSpan.textContent || '0');
                            const reviewsText = ratingContainer.textContent || '';
                            const match = reviewsText.match(/\((\d[\d,]*)\)/);
                            if (match && match[1])
                                reviewCount = parseInt(match[1].replace(/,/g, ''));
                        }
                    }
                    // Category — try data-item-id, then class fallbacks
                    const categoryBtn = doc.querySelector('button[data-item-id^="category"]')
                        || doc.querySelector('button[class*="D7r2ae"]')
                        || doc.querySelector('[jsaction*="category"]');
                    const category = categoryBtn?.textContent?.trim() || null;
                    // Opening hours — try the hours section
                    const hoursBtn = doc.querySelector('[data-item-id="oh"], [aria-label*="hours"], [aria-label*="Hours"]');
                    const hours = hoursBtn?.textContent?.trim() || null;
                    return { name, address, phone, website, rating, reviewCount, category, hours };
                });
                if (!data.name) {
                    progress.errors++;
                    ctx.onActivity?.('google_maps', `Could not extract business name, skipping: ${url}`);
                    continue;
                }
                progress.leadsFound++;
                // Crawl the business website for email & phone enrichment
                let crawledEmail = null;
                let crawledPhone = data.phone;
                if (data.website) {
                    ctx.onActivity?.('google_maps', `Crawling website for email: ${data.website}`);
                    try {
                        const webContacts = await crawlCompanyWebsite(data.website);
                        if (webContacts.emails.length > 0)
                            crawledEmail = webContacts.emails[0];
                        if (webContacts.phones.length > 0 && !crawledPhone)
                            crawledPhone = webContacts.phones[0];
                    }
                    catch {
                        // website crawl failed, continue with maps data
                    }
                }
                const leadData = {
                    vendorName: data.name,
                    email: crawledEmail || null,
                    phone: crawledPhone || null,
                    website: data.website || null,
                    location: data.address || null,
                    businessCategory: data.category || null,
                    listingUrl: url,
                    qualityScore: 0,
                    extractionMethod: 'google_maps',
                    additionalInfo: {
                        rating: data.rating?.toString() || '',
                        reviewsCount: data.reviewCount?.toString() || '',
                        address: data.address || '',
                        openingHours: data.hours || '',
                        googleMapsUrl: url,
                        crawledAt: new Date().toISOString(),
                        source: 'google_maps',
                    },
                };
                const normalized = normalizeLead(leadData);
                // Efficient dedup using composite key
                const dedupKey = `${(normalized.vendorName || '').toLowerCase()}|${normalized.phone || ''}|${normalized.email || ''}`;
                if (storedLeadKeys.has(dedupKey)) {
                    continue;
                }
                // Cross-job database duplicate check for the same tenant
                const dbConditions = [];
                if (normalized.email)
                    dbConditions.push(eq(schema.leads.email, normalized.email));
                if (normalized.phone)
                    dbConditions.push(eq(schema.leads.phone, normalized.phone));
                if (normalized.vendorName)
                    dbConditions.push(eq(schema.leads.vendorName, normalized.vendorName));
                if (dbConditions.length > 0) {
                    const existingDBLeads = await db.select({ id: schema.leads.id })
                        .from(schema.leads)
                        .where(and(eq(schema.leads.tenantId, ctx.tenantId), or(...dbConditions)))
                        .limit(1);
                    if (existingDBLeads.length > 0) {
                        ctx.onActivity?.('google_maps', `Lead "${normalized.vendorName}" already exists in database, skipping to prevent duplicates.`);
                        continue;
                    }
                }
                const score = scoreLead(normalized);
                await db.insert(schema.leads).values({
                    tenantId: ctx.tenantId,
                    jobId: ctx.jobId,
                    ...normalized,
                    qualityScore: score,
                    extractionMethod: 'google_maps',
                });
                storedLeadKeys.add(dedupKey);
                progress.leadsStored++;
                ctx.onLead?.(normalized);
                // Increment leads_monthly usage
                await redis.incr(limitKey).catch(() => { });
            }
            catch (err: any) {
                progress.errors++;
                ctx.onActivity?.('google_maps', `Error extracting place: ${err.message}`);
            }
            // Update progress
            await db.update(schema.jobs).set({ progress: progress }).where(eq(schema.jobs.id, ctx.jobId));
            ctx.onProgress?.(progress);
            // Randomized delay to avoid detection
            await sleep(getJitteredDelay(crawlDelay));
        }
        // 3. Mark completed
        await db.update(schema.jobs)
            .set({ status: 'completed', completedAt: new Date(), progress: progress })
            .where(eq(schema.jobs.id, ctx.jobId));
        ctx.onActivity?.('orchestrator', `Google Maps Scraper complete. Stored ${progress.leadsStored} leads from ${progress.pagesCrawled} pages.`);
        ctx.onProgress?.(progress);
    }
    catch (error: any) {
        logger.error({ jobId: ctx.jobId, error }, 'Google Maps Scraper failed');
        // Report proxy failure if we were using one
        if (proxyServer) {
            await reportProxyResult(proxyServer, false, 0).catch(() => { });
        }
        await db.update(schema.jobs)
            .set({ status: 'failed', completedAt: new Date(), errorLog: error.message })
            .where(eq(schema.jobs.id, ctx.jobId));
        throw error;
    }
    finally {
        // Report proxy success if job completed (not thrown)
        if (proxyServer && progress.leadsStored > 0) {
            await reportProxyResult(proxyServer, true, 0).catch(() => { });
        }
        if (context)
            await context.close().catch(() => { });
        if (browser)
            await browser.close().catch(() => { });
        await pool.end();
        await redis.quit().catch(() => {});
    }
}