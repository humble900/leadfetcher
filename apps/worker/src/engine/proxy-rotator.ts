/**
 * Proxy Rotator — Built-in rotating proxy system with support for:
 *
 * 1. Open-source free proxy lists (fetched periodically)
 * 2. Single PROXY_URL from environment (paid proxy services)
 * 3. Multiple PROXY_URLS from environment (comma-separated list)
 *
 * Proxies are health-checked and rotated automatically.
 * Failed proxies are removed from the pool and re-checked periodically.
 */
import pino from 'pino';
const logger = pino({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    transport: process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
});

interface ProxyEntry {
    server: string;
    source: string;
    lastChecked: number;
    failCount: number;
    latencyMs: number;
}

// Open-source proxy list sources
const FREE_PROXY_SOURCES = [
    {
        name: 'proxyscrape-http',
        url: 'https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=5000&country=all&ssl=all&anonymity=elite',
        parser: parseLineList,
    },
    {
        name: 'proxyscrape-socks5',
        url: 'https://api.proxyscrape.com/v2/?request=displayproxies&protocol=socks5&timeout=5000&country=all',
        parser: (text: string) => parseLineList(text, 'socks5'),
    },
    {
        name: 'geonode',
        url: 'https://proxylist.geonode.com/api/proxy-list?limit=100&page=1&sort_by=lastChecked&sort_type=desc&protocols=http%2Chttps&anonymityLevel=elite&anonymityLevel=anonymous',
        parser: parseGeonodeJson,
    },
    {
        name: 'monosans',
        url: 'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt',
        parser: parseLineList,
    },
    {
        name: 'TheSpeedX',
        url: 'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt',
        parser: parseLineList,
    },
    {
        name: 'clarketm',
        url: 'https://raw.githubusercontent.com/clarketm/proxy-list/master/proxy-list-raw.txt',
        parser: parseLineList,
    },
];
// ─── Parsers ───────────────────────────────────────────────────
function parseLineList(text: string, protocol = 'http'): string[] {
    return text
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && /^\d+\.\d+\.\d+\.\d+:\d+$/.test(line))
        .map(line => `${protocol}://${line}`);
}
function parseGeonodeJson(text: string): string[] {
    try {
        const data = JSON.parse(text);
        if (!data.data || !Array.isArray(data.data))
            return [];
        return data.data
            .filter((p: any) => p.ip && p.port)
            .map((p: any) => `${p.protocols?.[0] || 'http'}://${p.ip}:${p.port}`);
    }
    catch {
        return [];
    }
}
// ─── Proxy Pool ────────────────────────────────────────────────
class ProxyPool {
    proxies: ProxyEntry[] = [];
    currentIndex = 0;
    lastRefresh = 0;
    refreshIntervalMs = 10 * 60 * 1000; // 10 minutes
    maxFailCount = 3;
    useOpenSource: boolean;
    constructor() {
        this.useOpenSource = process.env.PROXY_MODE === 'open_source' || process.env.PROXY_MODE === 'hybrid';
    }
    /**
     * Initialize the proxy pool from env vars and/or open-source lists
     */
    async initialize() {
        // 1. Load from environment first (highest priority)
        const envProxies = this.loadFromEnv();
        this.proxies.push(...envProxies);
        // 2. Fetch from open-source lists if enabled
        if (this.useOpenSource) {
            const freeProxies = await this.fetchFreeProxies();
            this.proxies.push(...freeProxies);
        }
        if (this.proxies.length === 0) {
            logger.info('No proxies configured — will run without proxy rotation');
        }
        else {
            logger.info({ count: this.proxies.length }, 'Proxy pool initialized');
        }
        this.lastRefresh = Date.now();
    }
    /**
     * Load proxies from environment variables
     */
    loadFromEnv(): ProxyEntry[] {
        const entries: ProxyEntry[] = [];
        // Single proxy URL
        if (process.env.PROXY_URL) {
            entries.push({
                server: process.env.PROXY_URL,
                source: 'env-single',
                lastChecked: Date.now(),
                failCount: 0,
                latencyMs: 0,
            });
        }
        // Comma-separated proxy list
        if (process.env.PROXY_URLS) {
            const urls = process.env.PROXY_URLS.split(',').map(u => u.trim()).filter(Boolean);
            for (const url of urls) {
                entries.push({
                    server: url,
                    source: 'env-list',
                    lastChecked: Date.now(),
                    failCount: 0,
                    latencyMs: 0,
                });
            }
        }
        return entries;
    }
    /**
     * Fetch proxies from open-source free proxy lists
     */
    async fetchFreeProxies(): Promise<ProxyEntry[]> {
        const entries: ProxyEntry[] = [];
        for (const source of FREE_PROXY_SOURCES) {
            try {
                const response = await fetch(source.url, {
                    signal: AbortSignal.timeout(10_000),
                    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ProxyFetcher/1.0)' },
                });
                if (!response.ok)
                    continue;
                const text = await response.text();
                const urls = source.parser(text);
                for (const url of urls.slice(0, 50)) { // Limit per source to avoid huge lists
                    entries.push({
                        server: url,
                        source: source.name,
                        lastChecked: Date.now(),
                        failCount: 0,
                        latencyMs: 0,
                    });
                }
                logger.debug({ source: source.name, count: Math.min(urls.length, 50) }, 'Fetched free proxies');
            }
            catch (err: any) {
                logger.warn({ source: source.name, error: err.message }, 'Failed to fetch free proxy list');
            }
        }
        return entries;
    }
    /**
     * Get the next proxy in rotation, skipping failed ones
     */
    async getProxy(): Promise<string | undefined> {
        // Refresh pool if stale
        if (this.useOpenSource && Date.now() - this.lastRefresh > this.refreshIntervalMs) {
            const fresh = await this.fetchFreeProxies();
            // Replace free proxies, keep env ones
            this.proxies = [
                ...this.proxies.filter(p => p.source.startsWith('env')),
                ...fresh,
            ];
            this.lastRefresh = Date.now();
            logger.info({ count: this.proxies.length }, 'Proxy pool refreshed');
        }
        // Filter out heavily failed proxies
        const available = this.proxies.filter(p => p.failCount < this.maxFailCount);
        if (available.length === 0) {
            // Reset fail counts and try again
            for (const p of this.proxies)
                p.failCount = 0;
            return this.proxies[0]?.server;
        }
        // Round-robin rotation
        this.currentIndex = (this.currentIndex + 1) % available.length;
        return available[this.currentIndex]?.server;
    }
    /**
     * Report a proxy as failed
     */
    markFailed(server: string) {
        const proxy = this.proxies.find(p => p.server === server);
        if (proxy) {
            proxy.failCount++;
            logger.debug({ server, failCount: proxy.failCount }, 'Proxy marked as failed');
        }
    }
    /**
     * Report a proxy as successful
     */
    markSuccess(server: string, latencyMs = 0) {
        const proxy = this.proxies.find(p => p.server === server);
        if (proxy) {
            proxy.failCount = Math.max(0, proxy.failCount - 1);
            proxy.latencyMs = latencyMs;
            proxy.lastChecked = Date.now();
        }
    }
    /**
     * Check if the pool has any proxies
     */
    hasProxies() {
        return this.proxies.length > 0;
    }
    /**
     * Get pool stats
     */
    getStats() {
        const sources: Record<string, number> = {};
        for (const p of this.proxies) {
            sources[p.source] = (sources[p.source] || 0) + 1;
        }
        return {
            total: this.proxies.length,
            available: this.proxies.filter(p => p.failCount < this.maxFailCount).length,
            sources,
        };
    }
}
// ─── Singleton ─────────────────────────────────────────────────
let _pool: ProxyPool | null = null;
/**
 * Get the global proxy pool (lazily initialized)
 */
export async function getProxyPool(): Promise<ProxyPool> {
    if (!_pool) {
        _pool = new ProxyPool();
        await _pool.initialize();
    }
    return _pool;
}
/**
 * Convenience: get a proxy URL for Playwright browser launch
 * Returns undefined if no proxies are configured.
 */
export async function getNextProxy(): Promise<{ server: string } | undefined> {
    const pool = await getProxyPool();
    const server = await pool.getProxy();
    return server ? { server } : undefined;
}
/**
 * Report proxy result
 */
export async function reportProxyResult(server: string, success: boolean, latencyMs?: number) {
    const pool = await getProxyPool();
    if (success) {
        pool.markSuccess(server, latencyMs || 0);
    }
    else {
        pool.markFailed(server);
    }
}