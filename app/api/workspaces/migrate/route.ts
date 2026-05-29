import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/session';
import { ensureUserRecordForSession } from '@/lib/server/ensure-user-record';
import { getWorkspaceStore } from '@/lib/server/workspaces/store';
import { parseWorkspaceSnapshotString } from '@/lib/workspace-snapshot';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Bulk upsert snapshots (localStorage migration). */
export async function POST(req: Request) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  let body: { snapshots?: string[]; dashboardLayouts?: Record<string, unknown> } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const store = getWorkspaceStore();
  let migrated = 0;
  try {
    await ensureUserRecordForSession(session);
    for (const json of body.snapshots ?? []) {
      if (typeof json !== 'string') continue;
      const parsed = parseWorkspaceSnapshotString(json);
      if (!parsed.ok) continue;
      await store.upsertSnapshot(session.sub, {
        version: 1,
        savedAt: new Date().toISOString(),
        keyword: parsed.state.keyword,
        goal: parsed.state.goal,
        ...(parsed.state.context ? { context: parsed.state.context } : {}),
        nodes: parsed.state.nodes as never,
        edges: parsed.state.edges,
        viewport: parsed.state.viewport,
        dashboardNodeIds: parsed.state.dashboardNodeIds,
        collapsedNodeIds: parsed.state.collapsedNodeIds,
      });
      migrated += 1;
    }
    if (body.dashboardLayouts && typeof body.dashboardLayouts === 'object') {
      for (const [keyword, layout] of Object.entries(body.dashboardLayouts)) {
        if (!Array.isArray(layout)) continue;
        await store.saveDashboardLayout(session.sub, keyword, layout as never);
      }
    }
    return NextResponse.json({ ok: true, migrated });
  } catch (e) {
    console.error('[workspaces migrate POST]', e);
    return NextResponse.json({ error: 'store_error' }, { status: 500 });
  }
}
