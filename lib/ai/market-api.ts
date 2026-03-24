type Json = Record<string, unknown>;

interface MarketQuote {
  symbol: string;
  price?: number;
  change?: number;
  changePercent?: number;
  currency?: string;
  asOf?: string;
  source?: string;
}

function isCompareIntent(question: string): boolean {
  return /(비교|동종|유사|peer|peers|compare|competitor)/i.test(question);
}

const COMPANY_TO_TICKER: Record<string, string> = {
  NIKE: 'NKE',
  APPLE: 'AAPL',
  MICROSOFT: 'MSFT',
  GOOGLE: 'GOOGL',
  ALPHABET: 'GOOGL',
  NVIDIA: 'NVDA',
  AMAZON: 'AMZN',
  TESLA: 'TSLA',
  META: 'META',
};

function readString(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function readNumber(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v.replace(/,/g, ''));
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function pickObject(v: unknown): Json | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null;
}

function maybeTickerFromQuestion(question: string): string | null {
  const direct = question.match(/\$([A-Za-z]{1,8})\b/);
  if (direct?.[1]) return direct[1].toUpperCase();
  for (const [name, ticker] of Object.entries(COMPANY_TO_TICKER)) {
    if (question.toUpperCase().includes(name)) return ticker;
  }
  const upperTokens = question.match(/\b[A-Z]{2,6}\b/g);
  if (!upperTokens || upperTokens.length === 0) return null;
  const stop = new Set(['API', 'JSON', 'HTTP', 'GET', 'POST', 'ETF', 'USD', 'KRW']);
  const hit = upperTokens.find((t) => !stop.has(t));
  return hit ?? null;
}

function maybeCompanyQueryFromQuestion(question: string): string | null {
  const latin = question.match(/\b([A-Za-z][A-Za-z0-9.&\-\s]{1,40})\b/g);
  if (!latin || latin.length === 0) return null;
  // Prefer explicit all-caps token first (e.g. NIKE), then longest phrase.
  const caps = latin.find((x) => /^[A-Z]{3,12}$/.test(x.trim()));
  if (caps) return caps.trim();
  const sorted = [...latin].sort((a, b) => b.length - a.length);
  return sorted[0]?.trim() ?? null;
}

function normalizeQuote(raw: unknown, fallbackSymbol: string): MarketQuote | null {
  const obj = pickObject(raw);
  if (!obj) return null;

  const candidate = obj.quote && pickObject(obj.quote) ? (obj.quote as Json) : obj;
  const symbol = readString(candidate.symbol) ?? fallbackSymbol;
  const price =
    readNumber(candidate.price) ??
    readNumber(candidate.c) ??
    readNumber(candidate.last) ??
    readNumber(candidate.lastPrice) ??
    readNumber(candidate.close);
  const change =
    readNumber(candidate.change) ??
    readNumber(candidate.d) ??
    readNumber(candidate.delta);
  const changePercent =
    readNumber(candidate.changePercent) ??
    readNumber(candidate.dp) ??
    readNumber(candidate.percentChange) ??
    readNumber(candidate.change_rate);
  const currency = readString(candidate.currency) ?? readString(candidate.quoteCurrency);
  const asOf =
    readString(candidate.asOf) ??
    readString(candidate.timestamp) ??
    (typeof candidate.t === 'number' ? new Date(candidate.t * 1000).toISOString() : undefined) ??
    readString(candidate.updatedAt) ??
    readString(candidate.time);
  const source = readString(obj.source) ?? readString(candidate.source);

  if (price === undefined && change === undefined && changePercent === undefined) return null;
  return { symbol, price, change, changePercent, currency, asOf, source };
}

function quoteToDataNodePayload(quote: MarketQuote): {
  dataType: 'metric';
  title: string;
  subtitle?: string;
  metrics: { label: string; value: string; change?: string; up?: boolean }[];
} {
  const priceText =
    quote.price !== undefined
      ? `${quote.price.toLocaleString(undefined, { maximumFractionDigits: 6 })}${
          quote.currency ? ` ${quote.currency}` : ''
        }`
      : 'N/A';
  const changeText =
    quote.change !== undefined
      ? `${quote.change >= 0 ? '+' : ''}${quote.change.toLocaleString(undefined, {
          maximumFractionDigits: 6,
        })}`
      : undefined;
  const changePctText =
    quote.changePercent !== undefined
      ? `${quote.changePercent >= 0 ? '+' : ''}${quote.changePercent.toFixed(2)}%`
      : undefined;

  return {
    dataType: 'metric',
    title: `${quote.symbol} quote`,
    subtitle: quote.asOf ? `as of ${quote.asOf}${quote.source ? ` · ${quote.source}` : ''}` : quote.source,
    metrics: [
      { label: 'Price', value: priceText, up: (quote.change ?? 0) >= 0 },
      ...(changeText ? [{ label: 'Change', value: changeText, up: (quote.change ?? 0) >= 0 }] : []),
      ...(changePctText
        ? [{ label: 'Change %', value: changePctText, up: (quote.changePercent ?? 0) >= 0 }]
        : []),
    ],
  };
}

function buildMarketApiUrl(symbol: string): string | null {
  const template = readString(process.env.MARKET_API_URL_TEMPLATE);
  if (!template) return null;
  return template
    .replaceAll('{symbol}', encodeURIComponent(symbol))
    .replaceAll('{SYMBOL}', encodeURIComponent(symbol.toUpperCase()));
}

function withApiKey(url: string): { url: string; headers: Record<string, string> } {
  const key = readString(process.env.MARKET_API_KEY);
  const keyQuery = readString(process.env.MARKET_API_KEY_QUERY_PARAM);
  const keyHeader = readString(process.env.MARKET_API_KEY_HEADER);
  if (!key) return { url, headers: {} };

  if (keyQuery) {
    const u = new URL(url);
    u.searchParams.set(keyQuery, key);
    return { url: u.toString(), headers: {} };
  }
  if (keyHeader) {
    return { url, headers: { [keyHeader]: key } };
  }
  return { url, headers: { Authorization: `Bearer ${key}` } };
}

async function fetchMarketQuote(url: string, headers: Record<string, string>): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers,
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchQuoteBySymbol(symbol: string): Promise<MarketQuote | null> {
  const url = buildMarketApiUrl(symbol);
  if (!url) return null;
  const req = withApiKey(url);
  const raw = await fetchMarketQuote(req.url, req.headers);
  return raw ? normalizeQuote(raw, symbol) : null;
}

async function resolveTickerViaFinnhubSearch(question: string): Promise<string | null> {
  const template = readString(process.env.MARKET_API_URL_TEMPLATE);
  if (!template || !template.includes('finnhub.io')) return null;

  const q = maybeCompanyQueryFromQuestion(question);
  if (!q) return null;

  const key = readString(process.env.MARKET_API_KEY);
  if (!key) return null;
  const keyQuery = readString(process.env.MARKET_API_KEY_QUERY_PARAM) ?? 'token';
  const keyHeader = readString(process.env.MARKET_API_KEY_HEADER);

  const url = new URL('https://finnhub.io/api/v1/search');
  url.searchParams.set('q', q);
  if (!keyHeader) url.searchParams.set(keyQuery, key);
  const headers: Record<string, string> = keyHeader ? { [keyHeader]: key } : {};

  try {
    const res = await fetch(url.toString(), { headers, cache: 'no-store' });
    if (!res.ok) return null;
    const raw = (await res.json()) as Json;
    const results = Array.isArray(raw.result) ? (raw.result as unknown[]) : [];
    const first = results
      .map((x) => (x && typeof x === 'object' ? (x as Json) : null))
      .filter(Boolean)
      .map((x) => readString((x as Json).symbol) ?? readString((x as Json).displaySymbol))
      .find((sym) => !!sym && /^[A-Z.\-]{1,10}$/.test(sym));
    return first ?? null;
  } catch {
    return null;
  }
}

async function fetchFinnhubIntradaySeries(symbol: string): Promise<{ label: string; value: number }[] | null> {
  const template = readString(process.env.MARKET_API_URL_TEMPLATE);
  if (!template || !template.includes('finnhub.io')) return null;
  const key = readString(process.env.MARKET_API_KEY);
  if (!key) return null;
  const keyQuery = readString(process.env.MARKET_API_KEY_QUERY_PARAM) ?? 'token';
  const keyHeader = readString(process.env.MARKET_API_KEY_HEADER);

  const nowSec = Math.floor(Date.now() / 1000);
  const fromSec = nowSec - 60 * 60 * 6;
  const url = new URL('https://finnhub.io/api/v1/stock/candle');
  url.searchParams.set('symbol', symbol);
  url.searchParams.set('resolution', '15');
  url.searchParams.set('from', String(fromSec));
  url.searchParams.set('to', String(nowSec));
  if (!keyHeader) url.searchParams.set(keyQuery, key);
  const headers: Record<string, string> = keyHeader ? { [keyHeader]: key } : {};

  try {
    const res = await fetch(url.toString(), { headers, cache: 'no-store' });
    if (!res.ok) return null;
    const raw = (await res.json()) as Json;
    if (raw.s !== 'ok') return null;
    const closes = Array.isArray(raw.c) ? (raw.c as unknown[]) : [];
    const times = Array.isArray(raw.t) ? (raw.t as unknown[]) : [];
    if (closes.length === 0 || closes.length !== times.length) return null;
    const sampled = closes
      .map((c, i) => ({
        c: readNumber(c),
        t: typeof times[i] === 'number' ? times[i] : null,
      }))
      .filter((x): x is { c: number; t: number } => x.c !== undefined && x.t !== null);
    if (sampled.length < 3) return null;
    const step = Math.max(1, Math.floor(sampled.length / 8));
    return sampled.filter((_, i) => i % step === 0 || i === sampled.length - 1).map((x) => ({
      label: new Date(x.t * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      value: x.c,
    }));
  } catch {
    return null;
  }
}

async function fetchFinnhubPeers(symbol: string): Promise<string[]> {
  const template = readString(process.env.MARKET_API_URL_TEMPLATE);
  if (!template || !template.includes('finnhub.io')) return [];
  const key = readString(process.env.MARKET_API_KEY);
  if (!key) return [];
  const keyQuery = readString(process.env.MARKET_API_KEY_QUERY_PARAM) ?? 'token';
  const keyHeader = readString(process.env.MARKET_API_KEY_HEADER);

  const url = new URL('https://finnhub.io/api/v1/stock/peers');
  url.searchParams.set('symbol', symbol);
  if (!keyHeader) url.searchParams.set(keyQuery, key);
  const headers: Record<string, string> = keyHeader ? { [keyHeader]: key } : {};

  try {
    const res = await fetch(url.toString(), { headers, cache: 'no-store' });
    if (!res.ok) return [];
    const raw = (await res.json()) as unknown;
    if (!Array.isArray(raw)) return [];
    return raw
      .map((x) => (typeof x === 'string' ? x.trim().toUpperCase() : ''))
      .filter((x) => !!x && /^[A-Z.\-]{1,10}$/.test(x));
  } catch {
    return [];
  }
}

export async function maybeGetMarketDataNodeFromApi(question: string): Promise<
  | {
      payload: {
        dataType: 'metric' | 'line-chart' | 'table';
        title: string;
        subtitle?: string;
        chartData?: { label: string; value: number }[];
        tableColumns?: string[];
        tableRows?: Record<string, string | number>[];
        metrics: { label: string; value: string; change?: string; up?: boolean }[];
      };
      symbol: string;
      summary: string;
    }
  | null
> {
  const symbol = maybeTickerFromQuestion(question);
  if (!symbol) return null;

  let quote = await fetchQuoteBySymbol(symbol);
  if (!quote || quote.price === undefined || quote.price <= 0) {
    // Common case: question used company name (e.g. "NIKE") not ticker ("NKE").
    const resolved = await resolveTickerViaFinnhubSearch(question);
    if (resolved && resolved !== symbol) {
      quote = await fetchQuoteBySymbol(resolved);
    }
  }
  if (!quote) return null;

  if (isCompareIntent(question)) {
    const peers = await fetchFinnhubPeers(quote.symbol);
    const targets = [quote.symbol, ...peers.filter((p) => p !== quote.symbol)].slice(0, 6);
    const quotes = await Promise.all(targets.map((s) => fetchQuoteBySymbol(s)));
    const rows = quotes
      .filter((q): q is MarketQuote => !!q && q.price !== undefined)
      .map((q) => ({
        Symbol: q.symbol,
        Price: Number(q.price!.toFixed(2)),
        'Change %':
          q.changePercent !== undefined ? `${q.changePercent >= 0 ? '+' : ''}${q.changePercent.toFixed(2)}%` : '-',
      }));
    if (rows.length >= 2) {
      return {
        payload: {
          dataType: 'table',
          title: `${quote.symbol} peer comparison`,
          subtitle: 'Price and daily change',
          tableColumns: ['Symbol', 'Price', 'Change %'],
          tableRows: rows,
          metrics: [],
        },
        symbol: quote.symbol,
        summary: `${quote.symbol}와 유사 종목 ${rows.length}개를 비교했습니다.`,
      };
    }
  }

  const intraday = await fetchFinnhubIntradaySeries(quote.symbol);
  const metricPayload = quoteToDataNodePayload(quote);
  const payload =
    intraday && intraday.length >= 3
      ? ({
          dataType: 'line-chart' as const,
          title: `${quote.symbol} intraday`,
          subtitle: metricPayload.subtitle,
          chartData: intraday,
          metrics: metricPayload.metrics,
        } as const)
      : metricPayload;

  const priceLine = metricPayload.metrics.find((m) => m.label === 'Price')?.value ?? 'N/A';
  const pctLine = metricPayload.metrics.find((m) => m.label === 'Change %')?.value;
  const summary = `${quote.symbol} 현재가 ${priceLine}${pctLine ? `, 변동률 ${pctLine}` : ''} 입니다.`;
  return { payload, symbol: quote.symbol, summary };
}

