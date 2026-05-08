import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/session';
import { getAnalyticsStore } from '@/lib/server/analytics/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  type?: 'search' | 'consent';
  keyword?: unknown;
  goal?: unknown;
  surface?: unknown;
  consentVersion?: unknown;
};

function asString(x: unknown, max = 256): string | undefined {
  if (typeof x !== 'string') return undefined;
  const v = x.trim();
  if (!v) return undefined;
  return v.slice(0, max);
}

export async function POST(req: Request) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const store = getAnalyticsStore();

  if (body.type === 'search') {
    const keyword = asString(body.keyword, 200);
    const goal = asString(body.goal, 64);
    if (!keyword || !goal) {
      return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
    }
    try {
      await store.recordSearch({
        sub: session.sub,
        email: session.email,
        keyword,
        goal,
        surface: asString(body.surface, 32),
        ts: Date.now(),
      });
    } catch (e) {
      console.error('[telemetry] search failed', e);
      return NextResponse.json({ error: 'store_error' }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (body.type === 'consent') {
    const version = asString(body.consentVersion, 32) ?? 'v1';
    try {
      await store.recordConsent({
        sub: session.sub,
        email: session.email,
        version,
        ts: Date.now(),
      });
    } catch (e) {
      console.error('[telemetry] consent failed', e);
      return NextResponse.json({ error: 'store_error' }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'unknown_type' }, { status: 400 });
}
