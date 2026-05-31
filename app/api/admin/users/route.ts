import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/auth/require-admin';
import { getAnalyticsStore, getAnalyticsStoreKind } from '@/lib/server/analytics/store';
import { ensureAdminTierForUser } from '@/lib/server/quota/sync-admin-tier';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.res;

  const url = new URL(req.url);
  const limit = clampInt(url.searchParams.get('limit'), 1, 500, 100);
  const sortRaw = url.searchParams.get('sort');
  const sort: 'lastSeen' | 'createdAt' | 'searchCount' =
    sortRaw === 'createdAt' || sortRaw === 'searchCount' ? sortRaw : 'lastSeen';

  try {
    const store = getAnalyticsStore();
    let users = await store.listUsers({ limit, sort });
    users = await Promise.all(users.map((u) => ensureAdminTierForUser(store, u)));
    const queryStats = await store.getQueryUsageStatsForUsers(users);
    return NextResponse.json({ users, queryStats });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[admin/users] failed', { message, error: e });
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
