import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/session';
import { isAdminEmail } from '@/lib/auth/admin';
import { ensureUserRecordForSession } from '@/lib/server/ensure-user-record';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }
  try {
    await ensureUserRecordForSession(session);
  } catch (e) {
    console.error('[auth/me] ensureUserRecord', e);
  }
  return NextResponse.json({
    authenticated: true,
    user: {
      sub: session.sub,
      email: session.email,
      name: session.name ?? null,
      picture: session.picture ?? null,
      isAdmin: isAdminEmail(session.email),
    },
  });
}
