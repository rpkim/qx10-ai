import { NextResponse } from 'next/server';
import { GOOGLE_TOKEN_COOKIE } from '@/lib/integrations/google-oauth-config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const cookieBase = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(GOOGLE_TOKEN_COOKIE, '', { ...cookieBase, maxAge: 0 });
  return res;
}
