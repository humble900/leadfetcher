/**
 * Job Processor — Orchestrates the full scraping pipeline for a single job.
 *
 * Two modes:
 * 1. LISTING MODE — For directory/listing pages with repeating cards
 * 2. DETAIL MODE — For individual vendor pages discovered via links
 *
 * Flow: Discover URLs → Detect Mode → Extract Data → Process → Store
 */

import { eq, and } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { Redis } from 'ioredis';
import pino from 'pino';
import * as schema from './db-schema.js';
import { discoverUrls, detectPaginationUrls } from '../engine/discovery.js';
import { hybridExtract } from '../engine/extractor.js';
import { smartFetch, getCrawlDelay, sleep, closeBrowser } from '../engine/fetcher.js';
import { normalizeLead, isDuplicate, scoreLead } from '../pipeline/processor.js';
import { extractListingCards, isListingPage } from '../engine/dom-extractor.js';
import type { SiteProfile, JobConfig } from '@leadfetcher/shared';
import * as cheerio from 'cheerio';
import { extractWithLLM } from '../engine/llm-extractor.js';
import { processGoogleMapsJob } from './google-maps.processor.js';
import { processProspectorJob } from './prospector.processor.js';

const { Pool } = pg;

const logger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
});

export interface JobContext {
  jobId: string;
  tenantId: string;
  targetUrl: string;
  config: Partial<JobConfig>;
  planLimits: {
    maxPagesPerJob: number;
    maxLeadsMonthly: number;
    maxConcurrentJobs: number;
    llmEnabled: boolean;
    maxLlmTokensMonthly: number;
  };
  databaseUrl: string;
  redisUrl: string;
  onProgress?: (data: Record<string, any>) => void;
  onActivity?: (agent: string, message: string) => void;
  onLead?: (lead: Record<string, any>) => void;
}

/**
 * Process a single scraping job
 */
export async function processJob(ctx: JobContext): Promise<void> {
  if ((ctx.config as any)?.type === 'google_maps') {
    return processGoogleMapsJob(ctx);
  }
  if ((ctx.config as any)?.type === 'prospector') {
    return processProspectorJob(ctx);
  }

  const pool = new Pool({ connectionString: ctx.databaseUrl });
  const db = drizzle(pool, { schema });
  const redis = new Redis(ctx.redisUrl);

  const progress = {
    pagesFound: 0,
    pagesCrawled: 0,
    leadsFound: 0,
    leadsStored: 0,
    errors: 0,
  };

  try {
    // Mark job as running
    await db.update(schema.jobs)
      .set({ status: 'running', startedAt: new Date(), progress: progress as any })
      .where(eq(schema.jobs.id, ctx.jobId));

    ctx.onActivity?.('orchestrator', `Starting crawl of ${ctx.targetUrl}`);

    // ─── Step 1: Fetch the target page ─────────────────────
    const maxPages = Math.min(ctx.config.maxPages || 100, ctx.planLimits.maxPagesPerJob);
    const { html: initialHtml } = await smartFetch(ctx.targetUrl, false);

    if (!initialHtml || initialHtml.length < 100) {
      throw new Error('Failed to fetch target URL — empty response');
    }

    // ─── Step 2: Detect mode — listing or detail? ──────────
    const isListing = isListingPage(initialHtml);
    ctx.onActivity?.('discovery', isListing ? 'Detected listing page — extracting cards' : 'Detected detail page — discovering URLs');

    const crawlDelay = getCrawlDelay(ctx.config.crawlDelay || 'normal');
    const storedLeads: Array<{ email?: string | null; phone?: string | null; vendorName?: string | null }> = [];

    if (isListing) {
      // ─── LISTING MODE: Extract cards from pagination pages ─
      let currentUrl: string | null = ctx.targetUrl;
      let pageNum = 0;

      while (currentUrl && pageNum < maxPages) {
        pageNum++;
        progress.pagesCrawled = pageNum;

        ctx.onActivity?.('extractor', `Extracting page ${pageNum}: ${currentUrl}`);

        const { html } = pageNum === 1
          ? { html: initialHtml }
          : await smartFetch(currentUrl, false);

        const cards = extractListingCards(html, currentUrl, null);
        progress.leadsFound += cards.length;

        for (const card of cards) {
          const normalized = normalizeLead(card);
          if (!isDuplicate(normalized, storedLeads)) {
            const score = scoreLead(normalized);
            if (score >= 20) {
              await db.insert(schema.leads).values({
                tenantId: ctx.tenantId,
                jobId: ctx.jobId,
                ...normalized,
                qualityScore: score,
                extractionMethod: 'script',
              } as any);
              storedLeads.push(normalized);
              progress.leadsStored++;
              ctx.onLead?.(normalized);
            }
          }
        }

        // Update progress
        await db.update(schema.jobs)
          .set({ progress: progress as any })
          .where(eq(schema.jobs.id, ctx.jobId));
        ctx.onProgress?.(progress);

        // Find next page
        const paginationUrls = detectPaginationUrls(html, currentUrl, null);
        currentUrl = paginationUrls.find(u => !u.includes(`page=${pageNum}`)) || null;

        await sleep(crawlDelay);
      }
    } else {
      // ─── DETAIL MODE: Discover URLs then visit each ────────
      const discovery = await discoverUrls(ctx.targetUrl, null, maxPages);
      progress.pagesFound = discovery.totalFound;

      ctx.onActivity?.('discovery', `Found ${discovery.totalFound} URLs via ${discovery.method}`);

      for (let i = 0; i < discovery.listingUrls.length && i < maxPages; i++) {
        const url = discovery.listingUrls[i]!;
        progress.pagesCrawled = i + 1;

        try {
          ctx.onActivity?.('extractor', `Extracting ${i + 1}/${discovery.listingUrls.length}: ${url}`);

          const { html } = await smartFetch(url, false);
          const lead = hybridExtract(html, url, null);
          const normalized = normalizeLead(lead);
          progress.leadsFound++;

          if (!isDuplicate(normalized, storedLeads)) {
            const score = scoreLead(normalized);
            if (score >= 20) {
              await db.insert(schema.leads).values({
                tenantId: ctx.tenantId,
                jobId: ctx.jobId,
                ...normalized,
                qualityScore: score,
                extractionMethod: 'script',
              } as any);
              storedLeads.push(normalized);
              progress.leadsStored++;
              ctx.onLead?.(normalized);
            }
          }
        } catch (err) {
          progress.errors++;
          logger.warn({ url, error: (err as Error).message }, 'Page extraction failed');
        }

        // Update progress every 5 pages
        if (i % 5 === 0) {
          await db.update(schema.jobs)
            .set({ progress: progress as any })
            .where(eq(schema.jobs.id, ctx.jobId));
          ctx.onProgress?.(progress);
        }

        await sleep(crawlDelay);
      }
    }

    // ─── Done ────────────────────────────────────────────────
    await db.update(schema.jobs)
      .set({
        status: 'completed',
        completedAt: new Date(),
        progress: progress as any,
      })
      .where(eq(schema.jobs.id, ctx.jobId));

    ctx.onActivity?.('orchestrator', `Job complete: ${progress.leadsStored} leads stored from ${progress.pagesCrawled} pages`);
    ctx.onProgress?.(progress);

  } catch (error) {
    logger.error({ jobId: ctx.jobId, error }, 'Job failed');

    await db.update(schema.jobs)
      .set({
        status: 'failed',
        completedAt: new Date(),
        errorLog: (error as Error).message,
        progress: progress as any,
      })
      .where(eq(schema.jobs.id, ctx.jobId));

    throw error;
  } finally {
    await closeBrowser();
    await pool.end();
    await redis.quit();
  }
}