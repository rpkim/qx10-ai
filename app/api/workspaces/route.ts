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
    const entries = await getWorkspaceStore().listIndex(session.sub);
    return NextResponse.json({ entries });
  } catch (e) {
    console.error('[workspaces GET]', e);
    return NextResponse.json({ error: 'store_error' }, { status: 500 });
  }
}
