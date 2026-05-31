import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/session';
import { ensureUserRecordForSession } from '@/lib/server/ensure-user-record';
import { getAnalyticsStore } from '@/lib/server/analytics/store';
import { ensureAdminTierForUser } from '@/lib/server/quota/sync-admin-tier';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  await ensureUserRecordForSession(session);
  const store = getAnalyticsStore();
  let user = await store.getUser(session.sub);
  if (!user) {
    return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
  }
  user = await ensureAdminTierForUser(store, user);

  const quota = await store.getUserQueryQuota(session.sub);
  if (!quota) {
    return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
  }

  return NextResponse.json(quota);
}
