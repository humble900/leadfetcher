import * as cheerio from 'cheerio';
import { smartFetch } from './fetcher.js';
/**
 * Perform a DuckDuckGo search and return parsed target URLs
 */
export async function searchWeb(query: string): Promise<string[]> {
    try {
        const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
        const { html } = await smartFetch(url, false);
        const $ = cheerio.load(html);
        const results: string[] = [];
        $('.result__a').each((_, el) => {
            const href = $(el).attr('href');
            if (href) {
                if (href.includes('uddg=')) {
                    try {
                        const urlObj = new URL(href.startsWith('http') ? href : `https://duckduckgo.com${href}`);
                        const uddg = urlObj.searchParams.get('uddg');
                        if (uddg) {
                            results.push(uddg);
                        }
                    }
                    catch {
                        results.push(href);
                    }
                }
                else if (href.startsWith('http') && !href.includes('duckduckgo.com')) {
                    results.push(href);
                }
            }
        });
        return results;
    }
    catch (err: any) {
        console.error(`DuckDuckGo search failed for query "${query}":`, err);
        return [];
    }
}
/**
 * Discover the company website from its name
 */
export async function discoverCompanyWebsite(companyName: string): Promise<string | null> {
    const query = `"${companyName}" company website`;
    const urls = await searchWeb(query);
    // Filter out social media and directory sites to get direct website
    const skipDomains = [
        'linkedin.com', 'facebook.com', 'wikipedia.org', 'twitter.com', 'x.com',
        'instagram.com', 'crunchbase.com', 'yelp.com', 'youtube.com', 'glassdoor.com',
        'yellowpages.com', 'tripadvisor.com'
    ];
    for (const url of urls) {
        try {
            const parsed = new URL(url);
            const isSkip = skipDomains.some(domain => parsed.hostname.includes(domain));
            if (!isSkip) {
                return parsed.origin; // Return root origin
            }
        }
        catch { }
    }
    // Fallback to first URL if none are found
    return urls[0] || null;
}
/**
 * Discover company LinkedIn page URL
 */
export async function discoverCompanyLinkedin(companyName: string): Promise<string | null> {
    const query = `site:linkedin.com/company/ "${companyName}"`;
    const urls = await searchWeb(query);
    for (const url of urls) {
        if (url.includes('linkedin.com/company/')) {
            return url;
        }
    }
    return null;
}

export interface DecisionMaker {
    name: string;
    title: string;
    linkedin: string;
}

/**
 * Discover decision makers (CEO, founders, directors) from search snippets
 */
export async function searchDecisionMakers(companyName: string): Promise<DecisionMaker[]> {
    const query = `site:linkedin.com/in/ "${companyName}" (founder OR owner OR CEO OR president OR director OR "chief executive" OR partner)`;
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    try {
        const { html } = await smartFetch(url, false);
        const $ = cheerio.load(html);
        const people: DecisionMaker[] = [];
        $('.result__body').each((_, el) => {
            const titleEl = $(el).find('.result__a');
            const href = titleEl.attr('href');
            if (!href)
                return;
            let targetUrl = href;
            if (href.includes('uddg=')) {
                try {
                    const urlObj = new URL(href.startsWith('http') ? href : `https://duckduckgo.com${href}`);
                    targetUrl = urlObj.searchParams.get('uddg') || href;
                }
                catch { }
            }
            if (!targetUrl.includes('linkedin.com/in/'))
                return;
            const titleText = titleEl.text().trim();
            const cleanTitle = titleText.replace(/\s*\|\s*LinkedIn/i, '');
            const parts = cleanTitle.split(/\s+[-–|]\s+/);
            let name = '';
            let title = 'Decision Maker';
            if (parts.length >= 1) {
                name = parts[0]?.trim() || '';
            }
            if (parts.length >= 2) {
                title = parts[1]?.trim() || 'Decision Maker';
            }
            // Filter out invalid names
            if (name && name.toLowerCase() !== 'linkedin' && !name.includes('...')) {
                // Prevent duplicate entries
                if (!people.some(p => p.linkedin === targetUrl)) {
                    people.push({
                        name,
                        title,
                        linkedin: targetUrl,
                    });
                }
            }
        });
        return people.slice(0, 5); // Return top 5 decision makers
    }
    catch (err: any) {
        console.error(`Failed to scrape decision makers for "${companyName}":`, err);
        return [];
    }
}