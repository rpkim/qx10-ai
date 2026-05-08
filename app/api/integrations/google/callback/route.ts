import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  GOOGLE_TOKEN_COOKIE,
  GOOGLE_OAUTH_NEXT_COOKIE,
  GOOGLE_OAUTH_STATE_COOKIE,
} from '@/lib/integrations/google-oauth-config';
import { exchangeCodeForTokens, fetchGoogleUserInfo } from '@/lib/integrations/google-oauth-exchange';
import { sealGoogleTokens } from '@/lib/integrations/google-token-crypto';
import { safeOAuthNextPath } from '@/lib/integrations/safe-oauth-redirect';
import {
  AUTH_SESSION_COOKIE,
  authCookieBase as authCookieBaseShared,
  authCookieMaxAge,
  sealAuthSession,
} from '@/lib/auth/session';
import { getAnalyticsStore } from '@/lib/server/analytics/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const cookieBase = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

function clearOAuthCookies(res: NextResponse) {
  res.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, '', { ...cookieBase, maxAge: 0 });
  res.cookies.set(GOOGLE_OAUTH_NEXT_COOKIE, '', { ...cookieBase, maxAge: 0 });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');

  const jar = await cookies();
  const expectedState = jar.get(GOOGLE_OAUTH_STATE_COOKIE)?.value;
  const nextRaw = jar.get(GOOGLE_OAUTH_NEXT_COOKIE)?.value;
  const nextPath = safeOAuthNextPath(nextRaw ?? null);

  const redirectSettings = (search: Record<string, string>) => {
    const u = new URL('/settings', origin);
    for (const [k, v] of Object.entries(search)) u.searchParams.set(k, v);
    const res = NextResponse.redirect(u);
    clearOAuthCookies(res);
    return res;
  };

  if (oauthError) {
    return redirectSettings({ gdrive: 'error', reason: oauthError });
  }

  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectSettings({ gdrive: 'error', reason: 'state' });
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    if (!tokens.refresh_token) {
      return redirectSettings({ gdrive: 'error', reason: 'no_refresh' });
    }

    let email: string | undefined;
    let name: string | undefined;
    let sub: string | undefined;
    let picture: string | undefined;
    try {
      const u = await fetchGoogleUserInfo(tokens.access_token);
      email = u.email;
      name = u.name;
      sub = u.sub;
      picture = u.picture;
    } catch {
      /* optional profile */
    }

    const sealed = sealGoogleTokens({
      refresh_token: tokens.refresh_token,
      email,
      name,
    });

    const dest = new URL(nextPath, origin);
    dest.searchParams.set('gdrive', 'connected');
    const res = NextResponse.redirect(dest);
    clearOAuthCookies(res);
    res.cookies.set(GOOGLE_TOKEN_COOKIE, sealed, { ...cookieBase, maxAge: 60 * 60 * 24 * 365 });

    // Drive consent implies the user has signed in with Google — establish
    // (or refresh) the app's sign-in session at the same time.
    if (sub && email) {
      const sealedSession = sealAuthSession({ sub, email, name, picture });
      res.cookies.set(AUTH_SESSION_COOKIE, sealedSession, {
        ...authCookieBaseShared,
        maxAge: authCookieMaxAge,
      });
      try {
        await getAnalyticsStore().upsertUserOnSignIn({
          sub,
          email,
          name,
          picture,
          ts: Date.now(),
        });
      } catch (e) {
        console.error('[telemetry] sign-in upsert (drive) failed', e);
      }
    }
    return res;
  } catch {
    return redirectSettings({ gdrive: 'error', reason: 'exchange' });
  }
}
