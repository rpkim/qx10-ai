import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

const FETCH_TIMEOUT_MS = 8000;
const MAX_HTML_BYTES = 3 * 1024 * 1024; // 3MB
const MAX_EXCERPT_CHARS = 4000;
const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_REDIRECTS = 3;

export interface PageExcerpt {
  url: string;
  title: string;
  excerpt: string;
}

/** In-memory best-effort cache; not shared across cold serverless instances, only helps warm ones. */
const cache = new Map<string, { expires: number; data: PageExcerpt | null }>();

/**
 * Blocks obvious SSRF targets (loopback / private / link-local / metadata hosts).
 * This is a best-effort literal-hostname check, not a full DNS-rebinding defense.
 */
function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.local') || h === '0.0.0.0') return true;
  if (h === '[::1]' || h === '::1') return true;
  if (h === '169.254.169.254') return true; // cloud metadata endpoint
  const ipv4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if (a === 127 || a === 10 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }
  return false;
}

function isFetchableUrl(url: URL): boolean {
  return (url.protocol === 'http:' || url.protocol === 'https:') && !isBlockedHost(url.hostname);
}

async function fetchHtmlFollowingRedirects(startUrl: URL): Promise<{ html: string; finalUrl: string } | null> {
  let current = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!isFetchableUrl(current)) return null;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(current.toString(), {
        signal: controller.signal,
        redirect: 'manual',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Qx10Bot/1.0; +https://qx10.lol)',
          Accept: 'text/html,application/xhtml+xml',
        },
      });
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) return null;
      try {
        current = new URL(location, current);
      } catch {
        return null;
      }
      continue;
    }

    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html') && !contentType.includes('xhtml')) return null;
    const len = res.headers.get('content-length');
    if (len && Number(len) > MAX_HTML_BYTES) return null;
    const html = await res.text();
    if (html.length > MAX_HTML_BYTES) return null;
    return { html, finalUrl: current.toString() };
  }
  return null;
}

async function fetchPageExcerptUncached(rawUrl: string): Promise<PageExcerpt | null> {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return null;
  }
  if (!isFetchableUrl(url)) return null;

  const fetched = await fetchHtmlFollowingRedirects(url);
  if (!fetched) return null;

  try {
    const dom = new JSDOM(fetched.html, { url: fetched.finalUrl });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();
    const text = (article?.textContent ?? dom.window.document.body?.textContent ?? '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!text) return null;
    const title = (article?.title ?? dom.window.document.title ?? url.hostname).trim();
    return { url: fetched.finalUrl, title, excerpt: text.slice(0, MAX_EXCERPT_CHARS) };
  } catch {
    return null;
  }
}

/** Fetches + extracts main article text from a URL, with a short in-memory cache. */
export async function fetchPageExcerpt(rawUrl: string): Promise<PageExcerpt | null> {
  const key = rawUrl.trim();
  const hit = cache.get(key);
  const now = Date.now();
  if (hit && hit.expires > now) return hit.data;

  const data = await fetchPageExcerptUncached(key);
  cache.set(key, { expires: now + CACHE_TTL_MS, data });
  return data;
}

export async function fetchPageExcerpts(urls: string[]): Promise<PageExcerpt[]> {
  const unique = Array.from(new Set(urls.map((u) => u.trim()).filter(Boolean)));
  const results = await Promise.all(unique.map((u) => fetchPageExcerpt(u).catch(() => null)));
  return results.filter((r): r is PageExcerpt => r !== null);
}
