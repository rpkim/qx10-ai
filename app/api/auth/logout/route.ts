import { NextResponse } from 'next/server';
import { AUTH_SESSION_COOKIE, authCookieBase } from '@/lib/auth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_SESSION_COOKIE, '', { ...authCookieBase, maxAge: 0 });
  return res;
}
