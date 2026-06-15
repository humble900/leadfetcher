import * as cheerio from 'cheerio';
/**
 * Fetch and scrape search results from DuckDuckGo HTML version
 */
export async function searchWeb(query: string): Promise<string[]> {
    try {
        const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
            },
            signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok)
            return [];
        const html = await response.text();
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
    catch (err) {
        console.error(`Search failed for "${query}":`, err);
        return [];
    }
}
/**
 * Retrieve search results with snippets
 */
export interface SearchSnippet {
    title: string;
    snippet: string;
    url: string;
}

export async function searchWebWithSnippets(query: string): Promise<SearchSnippet[]> {
    try {
        const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
            signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok)
            return [];
        const html = await response.text();
        const $ = cheerio.load(html);
        const snippets: SearchSnippet[] = [];
        $('.result__body').each((_, el) => {
            const titleEl = $(el).find('.result__a');
            const snippetEl = $(el).find('.result__snippet');
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
            snippets.push({
                title: titleEl.text().trim(),
                snippet: snippetEl.text().trim(),
                url: targetUrl,
            });
        });
        return snippets;
    }
    catch (err) {
        console.error(`Scrape snippets failed for "${query}":`, err);
        return [];
    }
}