import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/auth/require-admin';
import { getAnalyticsStore } from '@/lib/server/analytics/store';
import {
  getDefaultDailyQueryLimit,
  getPremiumTierDailyQueryLimit,
} from '@/lib/server/quota/config';
import { USER_TIERS, type UserTier } from '@/lib/server/quota/tiers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, ctx: { params: Promise<{ sub: string }> }) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.res;

  const { sub } = await ctx.params;
  if (!sub?.trim()) {
    return NextResponse.json({ error: 'sub required' }, { status: 400 });
  }

  let body: { tier?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const tier = body.tier;
  if (!tier || !USER_TIERS.includes(tier as UserTier)) {
    return NextResponse.json(
      { error: 'tier must be one of: free, premium, admin' },
      { status: 400 }
    );
  }

  try {
    const user = await getAnalyticsStore().updateUserTier(sub, tier as UserTier);
    return NextResponse.json({
      user,
      limits: {
        free: getDefaultDailyQueryLimit(),
        premium: getPremiumTierDailyQueryLimit(),
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
