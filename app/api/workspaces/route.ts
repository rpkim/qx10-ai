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
    const code =
      e && typeof e === 'object' && 'code' in e && (e as { code?: string }).code === 'PGRST205'
        ? 'schema_missing'
        : 'store_error';
    return NextResponse.json(
      {
        error: code,
        hint:
          code === 'schema_missing'
            ? 'Run db/workspaces-migration.sql in the Supabase SQL editor (or pnpm db:apply-workspaces).'
            : undefined,
      },
      { status: code === 'schema_missing' ? 503 : 500 }
    );
  }
}
