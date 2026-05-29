import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/session';
import { getWorkspaceStore } from '@/lib/server/workspaces/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  try {
    const prefs = await getWorkspaceStore().getUserPrefs(session.sub);
    return NextResponse.json({ prefs });
  } catch (e) {
    console.error('[user/prefs GET]', e);
    return NextResponse.json({ error: 'store_error' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  let body: { prefs?: Record<string, unknown> } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (!body.prefs || typeof body.prefs !== 'object') {
    return NextResponse.json({ error: 'invalid_prefs' }, { status: 400 });
  }
  try {
    await getWorkspaceStore().saveUserPrefs(session.sub, body.prefs);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[user/prefs PUT]', e);
    return NextResponse.json({ error: 'store_error' }, { status: 500 });
  }
}
