import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { assertGoogleClientConfigured } from '@/lib/integrations/google-oauth-config';
import {
  AUTH_OAUTH_NEXT_COOKIE,
  AUTH_OAUTH_STATE_COOKIE,
  AUTH_SESSION_COOKIE,
  authCookieBase,
  authCookieMaxAge,
  sealAuthSession,
} from '@/lib/auth/session';
import { safeOAuthNextPath } from '@/lib/integrations/safe-oauth-redirect';
import { getAnalyticsStore } from '@/lib/server/analytics/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authRedirectUri(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  if (!base) {
    throw new Error('NEXT_PUBLIC_APP_URL is required for Google sign-in');
  }
  return `${base}/api/auth/google/callback`;
}

async function exchangeCodeForIdentity(code: string): Promise<{
  access_token: string;
  id_token?: string;
  expires_in: number;
}> {
  assertGoogleClientConfigured();
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: authRedirectUri(),
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Token exchange failed: ${t}`);
  }
  return res.json();
}

async function fetchProfile(accessToken: string): Promise<{
  sub?: string;
  email?: string;
  name?: string;
  picture?: string;
  email_verified?: boolean;
}> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return {};
  return (await res.json()) as {
    sub?: string;
    email?: string;
    name?: string;
    picture?: string;
    email_verified?: boolean;
  };
}

function clearOAuthCookies(res: NextResponse) {
  res.cookies.set(AUTH_OAUTH_STATE_COOKIE, '', { ...authCookieBase, maxAge: 0 });
  res.cookies.set(AUTH_OAUTH_NEXT_COOKIE, '', { ...authCookieBase, maxAge: 0 });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');

  const jar = await cookies();
  const expectedState = jar.get(AUTH_OAUTH_STATE_COOKIE)?.value;
  const nextRaw = jar.get(AUTH_OAUTH_NEXT_COOKIE)?.value;
  const nextPath = safeOAuthNextPath(nextRaw ?? null) || '/';

  const redirectLogin = (search: Record<string, string>) => {
    const u = new URL('/login', origin);
    for (const [k, v] of Object.entries(search)) u.searchParams.set(k, v);
    const res = NextResponse.redirect(u);
    clearOAuthCookies(res);
    return res;
  };

  if (oauthError) {
    return redirectLogin({ error: oauthError });
  }

  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectLogin({ error: 'state' });
  }

  try {
    const tokens = await exchangeCodeForIdentity(code);
    const profile = await fetchProfile(tokens.access_token);

    if (!profile.sub || !profile.email) {
      return redirectLogin({ error: 'no_profile' });
    }

    const sealed = sealAuthSession({
      sub: profile.sub,
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
    });

    try {
      const ts = Date.now();
      const store = getAnalyticsStore();
      await store.upsertUserOnSignIn({
        sub: profile.sub,
        email: profile.email,
        name: profile.name,
        picture: profile.picture,
        ts,
      });
      // Sign-in is gated by the consent checkbox on /login, so we record the
      // user's consent here as well. Version is kept in sync with the login UI.
      await store.recordConsent({
        sub: profile.sub,
        email: profile.email,
        version: 'v1.1',
        ts,
      });
    } catch (e) {
      console.error('[telemetry] sign-in upsert failed', e);
    }

    const dest = new URL(nextPath, origin);
    const res = NextResponse.redirect(dest);
    clearOAuthCookies(res);
    res.cookies.set(AUTH_SESSION_COOKIE, sealed, {
      ...authCookieBase,
      maxAge: authCookieMaxAge,
    });
    return res;
  } catch {
    return redirectLogin({ error: 'exchange' });
  }
}
