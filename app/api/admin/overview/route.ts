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
  const backend = getAnalyticsStoreKind();
  const now = Date.now();

  try {
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
      backend,
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
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[admin/overview] failed', { backend, message, error: e });
    return NextResponse.json(
      {
        error: 'analytics_store_error',
        backend,
        message,
        hint:
          backend === 'supabase'
            ? 'If this is the first deploy with Supabase, apply db/schema.sql in your Supabase SQL editor.'
            : 'On Vercel/serverless, the local file backend is not durable. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) in production.',
      },
      { status: 500 }
    );
  }
}
