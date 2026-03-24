type Json = Record<string, unknown>;

interface McpCallResponse {
  ok: boolean;
  result?: unknown;
  error?: string;
}

interface MarketQuote {
  symbol: string;
  price?: number;
  change?: number;
  changePercent?: number;
  currency?: string;
  asOf?: string;
  source?: string;
}

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
  const upperTokens = question.match(/\b[A-Z]{2,6}\b/g);
  if (!upperTokens || upperTokens.length === 0) return null;
  const stop = new Set(['API', 'MCP', 'JSON', 'HTTP', 'GET', 'POST', 'ETF', 'USD', 'KRW']);
  const hit = upperTokens.find((t) => !stop.has(t));
  return hit ?? null;
}

function normalizeQuote(raw: unknown, fallbackSymbol: string): MarketQuote | null {
  const obj = pickObject(raw);
  if (!obj) return null;

  const candidate = obj.quote && pickObject(obj.quote) ? (obj.quote as Json) : obj;
  const symbol = readString(candidate.symbol) ?? fallbackSymbol;
  const price =
    readNumber(candidate.price) ??
    readNumber(candidate.last) ??
    readNumber(candidate.lastPrice) ??
    readNumber(candidate.close);
  const change = readNumber(candidate.change) ?? readNumber(candidate.delta);
  const changePercent =
    readNumber(candidate.changePercent) ??
    readNumber(candidate.percentChange) ??
    readNumber(candidate.change_rate);
  const currency = readString(candidate.currency) ?? readString(candidate.quoteCurrency);
  const asOf =
    readString(candidate.asOf) ??
    readString(candidate.timestamp) ??
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

async function callMcpTool(args: {
  bridgeUrl: string;
  server: string;
  toolName: string;
  arguments: Record<string, unknown>;
  timeoutMs: number;
}): Promise<McpCallResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), args.timeoutMs);
  try {
    const res = await fetch(args.bridgeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        server: args.server,
        toolName: args.toolName,
        arguments: args.arguments,
      }),
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!res.ok) {
      return { ok: false, error: `bridge_http_${res.status}` };
    }
    const json = (await res.json()) as Json;
    const result = json.result ?? json.data ?? json;
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'bridge_error' };
  } finally {
    clearTimeout(timer);
  }
}

export async function maybeGetMarketDataNodeFromMcp(question: string): Promise<
  | {
      payload: {
        dataType: 'metric';
        title: string;
        subtitle?: string;
        metrics: { label: string; value: string; change?: string; up?: boolean }[];
      };
      symbol: string;
    }
  | null
> {
  const bridgeUrl = readString(process.env.MCP_BRIDGE_URL);
  const server = readString(process.env.MCP_MARKET_SERVER);
  const toolName = readString(process.env.MCP_MARKET_TOOL);
  if (!bridgeUrl || !server || !toolName) return null;

  const symbol = maybeTickerFromQuestion(question);
  if (!symbol) return null;

  const call = await callMcpTool({
    bridgeUrl,
    server,
    toolName,
    arguments: { symbol },
    timeoutMs: 9000,
  });
  if (!call.ok) return null;

  const resultObj = pickObject(call.result) ?? {};
  const fromStructured = pickObject(resultObj.structuredContent) ?? pickObject(resultObj.content) ?? resultObj;
  const quote = normalizeQuote(fromStructured, symbol);
  if (!quote) return null;

  return {
    payload: quoteToDataNodePayload(quote),
    symbol: quote.symbol,
  };
}

