import { eq, and } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { Redis } from 'ioredis';
import pino from 'pino';
import * as schema from './db-schema.js';
import { smartFetch, closeBrowser } from '../engine/fetcher.js';
import { regexExtract } from '../engine/regex-extractor.js';
import { discoverCompanyWebsite, discoverCompanyLinkedin, searchDecisionMakers } from '../engine/prospector-search.js';
import * as cheerio from 'cheerio';
import { JobContext } from './job.processor.js';
const { Pool } = pg;
const logger = pino({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    transport: process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
});
/**
 * Crawl the company's website to find general contacts (emails, phone numbers)
 */
export async function crawlCompanyWebsite(websiteUrl: string): Promise<{ emails: string[]; phones: string[] }> {
    const emails = new Set<string>();
    const phones = new Set<string>();
    try {
        // 1. Fetch homepage
        const { html: homeHtml } = await smartFetch(websiteUrl, false);
        if (!homeHtml || homeHtml.length < 100)
            return { emails: [], phones: [] };
        const homeContacts = regexExtract(homeHtml);
        homeContacts.emails.forEach(e => emails.add(e));
        homeContacts.phones.forEach(p => phones.add(p));
        // 2. Discover team/contact links
        const $ = cheerio.load(homeHtml);
        const subpages: string[] = [];
        $('a').each((_, el) => {
            const href = $(el).attr('href');
            const text = $(el).text().trim().toLowerCase();
            if (href && (text.includes('contact') ||
                text.includes('about') ||
                text.includes('team') ||
                text.includes('people') ||
                text.includes('leadership'))) {
                try {
                    const resolved = new URL(href, websiteUrl).href;
                    if (resolved.startsWith(websiteUrl) && !subpages.includes(resolved)) {
                        subpages.push(resolved);
                    }
                }
                catch { }
            }
        });
        // Fetch up to 2 subpages to extract team contacts
        for (const subpage of subpages.slice(0, 2)) {
            try {
                const { html: pageHtml } = await smartFetch(subpage, false);
                if (pageHtml) {
                    const pageContacts = regexExtract(pageHtml);
                    pageContacts.emails.forEach(e => emails.add(e));
                    pageContacts.phones.forEach(p => phones.add(p));
                }
            }
            catch { }
        }
    }
    catch (err: any) {
        logger.warn({ websiteUrl, err: err.message }, 'Failed to crawl company website');
    }
    return {
        emails: [...emails],
        phones: [...phones],
    };
}
/**
 * Process a Company Prospector job
 */
export async function processProspectorJob(ctx: JobContext) {
    const pool = new Pool({ connectionString: ctx.databaseUrl });
    const db = drizzle(pool, { schema });
    const redis = new Redis(ctx.redisUrl, {
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
    });
    redis.on('error', () => {}); // Suppress connection error crashes
    const rawCompanies = ((ctx.config as any).companies || []) as string[];
    const companies = Array.from(new Set(rawCompanies.map((c: string) => c.trim()).filter(Boolean)));
    const progress = {
        pagesFound: companies.length, // Representing total companies to process
        pagesCrawled: 0,
        leadsFound: 0,
        leadsStored: 0,
        errors: 0,
    };
    try {
        // Set status to running
        await db.update(schema.jobs)
            .set({ status: 'running', startedAt: new Date(), progress: progress })
            .where(eq(schema.jobs.id, ctx.jobId));
        ctx.onActivity?.('orchestrator', `Starting Prospector Job with ${companies.length} target companies`);
        const periodKey = new Date().toISOString().slice(0, 7); // YYYY-MM
        const limitKey = `limit:leads_monthly:${ctx.tenantId}:${periodKey}`;
        for (let i = 0; i < companies.length; i++) {
            const companyName = companies[i]?.trim();
            if (!companyName)
                continue;
            progress.pagesCrawled = i + 1;
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
            ctx.onActivity?.('prospector', `Processing company ${i + 1}/${companies.length}: "${companyName}"`);
            // Check if job has been cancelled in the database
            const [currentJob] = await db.select().from(schema.jobs).where(eq(schema.jobs.id, ctx.jobId)).limit(1);
            if (currentJob?.status === 'cancelled') {
                ctx.onActivity?.('orchestrator', 'Prospector Job cancelled by user.');
                return;
            }
            // Check database to see if we already have leads for this company under this tenant
            const existingDBLeads = await db.select({ id: schema.leads.id })
                .from(schema.leads)
                .where(and(eq(schema.leads.tenantId, ctx.tenantId), eq(schema.leads.vendorName, companyName)))
                .limit(1);
            if (existingDBLeads.length > 0) {
                ctx.onActivity?.('prospector', `Company "${companyName}" already exists in database, skipping to prevent duplicates.`);
                continue;
            }
            try {
                // Step 1: Discover website and company LinkedIn
                ctx.onActivity?.('prospector', `Discovering website and LinkedIn profile for "${companyName}"`);
                const website = await discoverCompanyWebsite(companyName);
                const companyLinkedin = await discoverCompanyLinkedin(companyName);
                // Step 2: Crawl website for general contact details
                let companyEmail = '';
                let companyPhone = '';
                if (website) {
                    ctx.onActivity?.('prospector', `Crawling website ${website} for contact info`);
                    const webContacts = await crawlCompanyWebsite(website);
                    companyEmail = webContacts.emails[0] || '';
                    companyPhone = webContacts.phones[0] || '';
                }
                // Step 3: Search for LinkedIn decision makers
                ctx.onActivity?.('prospector', `Finding decision makers for "${companyName}"`);
                const decisionMakers = await searchDecisionMakers(companyName);
                progress.leadsFound += decisionMakers.length;
                // Step 4: Save each decision maker as an individual row
                if (decisionMakers.length > 0) {
                    for (const person of decisionMakers) {
                        const score = 40; // Base quality score for a validated founder/CEO profile
                        await db.insert(schema.leads).values({
                            tenantId: ctx.tenantId,
                            jobId: ctx.jobId,
                            vendorName: companyName,
                            email: null, // Left null until enriched by the enrichment endpoint
                            phone: null,
                            website: website || null,
                            socialMedia: { linkedin: person.linkedin },
                            additionalInfo: {
                                type: 'prospector',
                                contactName: person.name,
                                contactTitle: person.title,
                                companyLinkedin: companyLinkedin || '',
                                companyEmail: companyEmail || '',
                                companyPhone: companyPhone || '',
                                source: 'prospector',
                            },
                            qualityScore: score,
                            extractionMethod: 'prospector',
                            isVerified: false,
                            listingUrl: `prospector://${ctx.jobId}/${encodeURIComponent(companyName)}`,
                        });
                        progress.leadsStored++;
                        // Increment leads_monthly usage
                        await redis.incr(limitKey);
                    }
                }
                else {
                    // If no decision makers found, insert at least one row representing the company general contacts
                    await db.insert(schema.leads).values({
                        tenantId: ctx.tenantId,
                        jobId: ctx.jobId,
                        vendorName: companyName,
                        email: companyEmail || null,
                        phone: companyPhone || null,
                        website: website || null,
                        socialMedia: companyLinkedin ? { companyLinkedin } : {},
                        additionalInfo: {
                            type: 'prospector',
                            contactName: 'General Inquiry',
                            contactTitle: 'Company Contact',
                            companyLinkedin: companyLinkedin || '',
                            companyEmail: companyEmail || '',
                            companyPhone: companyPhone || '',
                            source: 'prospector',
                        },
                        qualityScore: companyEmail || companyPhone ? 30 : 10,
                        extractionMethod: 'prospector',
                        isVerified: false,
                        listingUrl: `prospector://${ctx.jobId}/${encodeURIComponent(companyName)}`,
                    });
                    progress.leadsStored++;
                    // Increment leads_monthly usage
                    await redis.incr(limitKey);
                }
            }
            catch (err: any) {
                progress.errors++;
                logger.error({ companyName, err: err.message }, 'Failed to prospect company');
            }
            // Update progress
            await db.update(schema.jobs)
                .set({ progress: progress })
                .where(eq(schema.jobs.id, ctx.jobId));
            ctx.onProgress?.(progress);
        }
        // Mark completed
        await db.update(schema.jobs)
            .set({ status: 'completed', completedAt: new Date(), progress: progress })
            .where(eq(schema.jobs.id, ctx.jobId));
        ctx.onActivity?.('orchestrator', `Prospector Job complete. Stored ${progress.leadsStored} leads.`);
        ctx.onProgress?.(progress);
    }
    catch (error: any) {
        logger.error({ jobId: ctx.jobId, error }, 'Prospector Job failed');
        await db.update(schema.jobs)
            .set({ status: 'failed', completedAt: new Date(), errorLog: error.message })
            .where(eq(schema.jobs.id, ctx.jobId));
        throw error;
    }
    finally {
        await closeBrowser();
        await pool.end();
        await redis.quit().catch(() => {});
    }
}