import { NextResponse } from 'next/server';
import { getAuthSession, type AuthSession } from '@/lib/auth/session';
import { isAdminEmail } from '@/lib/auth/admin';

export async function requireAdminApi(): Promise<
  | { ok: true; session: AuthSession }
  | { ok: false; res: NextResponse }
> {
  const session = await getAuthSession();
  if (!session) {
    return { ok: false, res: NextResponse.json({ error: 'unauthenticated' }, { status: 401 }) };
  }
  if (!isAdminEmail(session.email)) {
    return { ok: false, res: NextResponse.json({ error: 'forbidden' }, { status: 403 }) };
  }
  return { ok: true, session };
}
