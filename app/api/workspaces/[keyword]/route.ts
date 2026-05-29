import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/session';
import { getWorkspaceStore } from '@/lib/server/workspaces/store';
import {
  parseWorkspaceSnapshot,
  workspaceToSnapshotPayload,
  type WorkspaceSnapshotFile,
} from '@/lib/workspace-snapshot';
import type { DashboardGridItem } from '@/lib/dashboard-layout-storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ keyword: string }> };

function decodeKeyword(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export async function GET(_req: Request, ctx: RouteContext) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  const keyword = decodeKeyword((await ctx.params).keyword);
  if (!keyword.trim()) {
    return NextResponse.json({ error: 'no_keyword' }, { status: 400 });
  }
  try {
    const store = getWorkspaceStore();
    const [snapshot, layout] = await Promise.all([
      store.getSnapshot(session.sub, keyword),
      store.getDashboardLayout(session.sub, keyword),
    ]);
    if (!snapshot) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    return NextResponse.json({ snapshot, dashboardLayout: layout });
  } catch (e) {
    console.error('[workspaces GET keyword]', e);
    return NextResponse.json({ error: 'store_error' }, { status: 500 });
  }
}

export async function PUT(req: Request, ctx: RouteContext) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  const keyword = decodeKeyword((await ctx.params).keyword);
  if (!keyword.trim()) {
    return NextResponse.json({ error: 'no_keyword' }, { status: 400 });
  }
  let body: { snapshot?: unknown; dashboardLayout?: DashboardGridItem[] | null } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = parseWorkspaceSnapshot(body.snapshot);
  if (!parsed.ok) {
    return NextResponse.json({ error: 'invalid_snapshot' }, { status: 400 });
  }
  if (parsed.state.keyword !== keyword) {
    return NextResponse.json({ error: 'keyword_mismatch' }, { status: 400 });
  }
  const snapshot: WorkspaceSnapshotFile = workspaceToSnapshotPayload(parsed.state);
  try {
    const store = getWorkspaceStore();
    await store.upsertSnapshot(session.sub, snapshot);
    if (body.dashboardLayout && Array.isArray(body.dashboardLayout)) {
      await store.saveDashboardLayout(session.sub, keyword, body.dashboardLayout);
    }
    return NextResponse.json({ ok: true, savedAt: snapshot.savedAt });
  } catch (e) {
    console.error('[workspaces PUT]', e);
    return NextResponse.json({ error: 'store_error' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  const keyword = decodeKeyword((await ctx.params).keyword);
  if (!keyword.trim()) {
    return NextResponse.json({ error: 'no_keyword' }, { status: 400 });
  }
  try {
    const removed = await getWorkspaceStore().deleteWorkspace(session.sub, keyword);
    return NextResponse.json({ ok: true, removed });
  } catch (e) {
    console.error('[workspaces DELETE]', e);
    return NextResponse.json({ error: 'store_error' }, { status: 500 });
  }
}
