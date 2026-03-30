import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import {
  GOOGLE_OAUTH_NEXT_COOKIE,
  GOOGLE_OAUTH_SCOPES,
  GOOGLE_OAUTH_STATE_COOKIE,
  assertGoogleClientConfigured,
  getGoogleRedirectUri,
} from '@/lib/integrations/google-oauth-config';
import { safeOAuthNextPath } from '@/lib/integrations/safe-oauth-redirect';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const cookieBase = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

export async function GET(req: Request) {
  try {
    assertGoogleClientConfigured();
    getGoogleRedirectUri();
  } catch {
    return NextResponse.json({ error: 'Google Drive backup is not configured on this server.' }, { status: 503 });
  }

  const url = new URL(req.url);
  const next = safeOAuthNextPath(url.searchParams.get('next'));
  const state = randomBytes(24).toString('hex');

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID!);
  authUrl.searchParams.set('redirect_uri', getGoogleRedirectUri());
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', GOOGLE_OAUTH_SCOPES);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('include_granted_scopes', 'true');

  const res = NextResponse.redirect(authUrl.toString());
  res.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, state, { ...cookieBase, maxAge: 600 });
  res.cookies.set(GOOGLE_OAUTH_NEXT_COOKIE, next, { ...cookieBase, maxAge: 600 });
  return res;
}
