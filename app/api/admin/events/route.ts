import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/auth/require-admin';
import { getAnalyticsStore, getAnalyticsStoreKind } from '@/lib/server/analytics/store';
import type { ActivityEvent } from '@/lib/server/analytics/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.res;

  const url = new URL(req.url);
  const typeRaw = url.searchParams.get('type');
  const type =
    typeRaw === 'signin' || typeRaw === 'search' || typeRaw === 'consent'
      ? (typeRaw as ActivityEvent['type'])
      : undefined;
  const sub = url.searchParams.get('sub') ?? undefined;
  const limit = clampInt(url.searchParams.get('limit'), 1, 500, 100);

  try {
    const events = await getAnalyticsStore().listEvents({ limit, type, sub });
    return NextResponse.json({ events });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[admin/events] failed', { message, error: e });
    return NextResponse.json(
      { error: 'analytics_store_error', backend: getAnalyticsStoreKind(), message },
      { status: 500 }
    );
  }
}

function clampInt(s: string | null, min: number, max: number, fallback: number): number {
  if (!s) return fallback;
  const n = Number.parseInt(s, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
