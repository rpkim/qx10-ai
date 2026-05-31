import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import {
  assertGoogleClientConfigured,
  assertAppUrlConfigured,
} from '@/lib/integrations/google-oauth-config';
import {
  AUTH_OAUTH_INVITE_COOKIE,
  AUTH_OAUTH_NEXT_COOKIE,
  AUTH_OAUTH_STATE_COOKIE,
  authCookieBase,
} from '@/lib/auth/session';
import { safeOAuthNextPath } from '@/lib/integrations/safe-oauth-redirect';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SIGN_IN_SCOPES = ['openid', 'email', 'profile'].join(' ');

/**
 * Identity-only Google sign-in (openid, email, profile).
 */
export async function GET(req: Request) {
  try {
    assertGoogleClientConfigured();
    assertAppUrlConfigured();
  } catch {
    return NextResponse.json(
      { error: 'Google sign-in is not configured on this server.' },
      { status: 503 }
    );
  }

  const url = new URL(req.url);
  const next = safeOAuthNextPath(url.searchParams.get('next')) || '/';
  const invite = url.searchParams.get('invite')?.trim().slice(0, 256) || '';
  const state = randomBytes(24).toString('hex');

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID!);
  authUrl.searchParams.set('redirect_uri', authRedirectUri());
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', SIGN_IN_SCOPES);
  authUrl.searchParams.set('access_type', 'online');
  authUrl.searchParams.set('prompt', 'select_account');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('include_granted_scopes', 'true');

  const res = NextResponse.redirect(authUrl.toString());
  res.cookies.set(AUTH_OAUTH_STATE_COOKIE, state, { ...authCookieBase, maxAge: 600 });
  res.cookies.set(AUTH_OAUTH_NEXT_COOKIE, next, { ...authCookieBase, maxAge: 600 });
  if (invite) {
    res.cookies.set(AUTH_OAUTH_INVITE_COOKIE, invite, { ...authCookieBase, maxAge: 600 });
  }
  return res;
}

function authRedirectUri(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  if (!base) {
    throw new Error('NEXT_PUBLIC_APP_URL is required for Google sign-in');
  }
  return `${base}/api/auth/google/callback`;
}
