import { maybeGetMarketDataNodeFromApi } from '@/lib/ai/market-api';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: Request) {
  let body: { symbol?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const symbol = typeof body.symbol === 'string' ? body.symbol.trim().toUpperCase() : '';
  if (!symbol) {
    return new Response(JSON.stringify({ error: 'symbol is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const market = await maybeGetMarketDataNodeFromApi(`$${symbol}`);
  if (!market) {
    return new Response(JSON.stringify({ error: 'Market data unavailable' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ symbol: market.symbol, payload: market.payload }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

