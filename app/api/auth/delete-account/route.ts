import { NextResponse } from 'next/server';
import {
  AUTH_OAUTH_NEXT_COOKIE,
  AUTH_OAUTH_STATE_COOKIE,
  AUTH_SESSION_COOKIE,
  authCookieBase,
  getAuthSession,
} from '@/lib/auth/session';
import { GOOGLE_TOKEN_COOKIE } from '@/lib/integrations/google-oauth-config';
import { getAnalyticsStore } from '@/lib/server/analytics/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Hard-delete the signed-in user from analytics storage and clear all
 * session/Drive cookies. The user's Google account itself is untouched —
 * we don't have permission to delete that, and the response includes the
 * URL where the user can revoke this app's Google access if they wish.
 */
export async function POST(req: Request) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  let confirm: { confirm?: unknown; email?: unknown } = {};
  try {
    confirm = (await req.json()) as typeof confirm;
  } catch {
    /* allow empty body */
  }

  // Require either a typed-email confirmation or the literal "DELETE" string.
  const ok =
    (typeof confirm.confirm === 'string' && confirm.confirm.trim().toUpperCase() === 'DELETE') ||
    (typeof confirm.email === 'string' &&
      confirm.email.trim().toLowerCase() === session.email.toLowerCase());
  if (!ok) {
    return NextResponse.json({ error: 'confirmation_required' }, { status: 400 });
  }

  let removed = false;
  try {
    removed = await getAnalyticsStore().deleteUser(session.sub);
  } catch (e) {
    console.error('[delete-account] store delete failed', e);
    return NextResponse.json({ error: 'store_error' }, { status: 500 });
  }

  const res = NextResponse.json({
    ok: true,
    removed,
    revokeUrl: 'https://myaccount.google.com/permissions',
  });
  for (const name of [
    AUTH_SESSION_COOKIE,
    AUTH_OAUTH_STATE_COOKIE,
    AUTH_OAUTH_NEXT_COOKIE,
    GOOGLE_TOKEN_COOKIE,
  ]) {
    res.cookies.set(name, '', { ...authCookieBase, maxAge: 0 });
  }
  return res;
}
