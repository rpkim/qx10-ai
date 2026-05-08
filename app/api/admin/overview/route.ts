import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/auth/require-admin';
import { getAnalyticsStore, getAnalyticsStoreKind } from '@/lib/server/analytics/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DAY = 24 * 60 * 60 * 1000;

export async function GET() {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.res;

  const store = getAnalyticsStore();
  const now = Date.now();
  const [
    totalUsers,
    activeUsers24h,
    activeUsers7d,
    activeUsers30d,
    signinsAllTime,
    signins24h,
    searchesAllTime,
    searches24h,
    consents,
    topKeywords,
  ] = await Promise.all([
    store.countUsers(),
    store.countActiveUsers(now - DAY),
    store.countActiveUsers(now - 7 * DAY),
    store.countActiveUsers(now - 30 * DAY),
    store.countEvents('signin'),
    store.countEvents('signin', now - DAY),
    store.countEvents('search'),
    store.countEvents('search', now - DAY),
    store.countEvents('consent'),
    store.topKeywords(20),
  ]);

  return NextResponse.json({
    backend: getAnalyticsStoreKind(),
    totals: {
      users: totalUsers,
      activeUsers24h,
      activeUsers7d,
      activeUsers30d,
      signinsAllTime,
      signins24h,
      searchesAllTime,
      searches24h,
      consents,
    },
    topKeywords,
  });
}
