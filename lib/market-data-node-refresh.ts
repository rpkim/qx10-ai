import type { DataNodeData } from '@/lib/types';

export type MarketQuoteNodePayload = Pick<
  DataNodeData,
  | 'dataType'
  | 'title'
  | 'subtitle'
  | 'metrics'
  | 'chartData'
  | 'tableColumns'
  | 'tableRows'
  | 'listItems'
>;

/** Live market quote nodes use title prefix like `NKE quote` or intraday in title. */
export function marketDataNodeRefreshSymbol(node: DataNodeData): string | null {
  const sym = (node.title.match(/^([A-Z.\-]{1,10})\s+/)?.[1] ?? '').toUpperCase();
  if (!sym) return null;
  if (!node.title.includes('quote') && !node.title.includes('intraday')) return null;
  return sym;
}

export async function fetchMarketQuotePayload(symbol: string): Promise<MarketQuoteNodePayload | null> {
  const res = await fetch('/api/market/quote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { payload?: MarketQuoteNodePayload };
  return data.payload ?? null;
}
