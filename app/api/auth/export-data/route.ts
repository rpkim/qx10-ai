import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/session';
import { getAnalyticsStore } from '@/lib/server/analytics/store';
import { getWorkspaceStore } from '@/lib/server/workspaces/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * "Right to Know" data export. Returns the full set of personal information
 * we hold about the requesting user, in a portable JSON format.
 */
export async function GET() {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const analyticsStore = getAnalyticsStore();
  const workspaceStore = getWorkspaceStore();
  let user = null;
  let events: unknown[] = [];
  let workspaceExport: Awaited<ReturnType<typeof workspaceStore.exportAllForUser>> | null = null;
  try {
    [user, events, workspaceExport] = await Promise.all([
      analyticsStore.getUser(session.sub),
      analyticsStore.listEvents({ sub: session.sub, limit: 5000 }),
      workspaceStore.exportAllForUser(session.sub),
    ]);
  } catch (e) {
    console.error('[export-data] failed', e);
    return NextResponse.json({ error: 'store_error' }, { status: 500 });
  }

  const payload = {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    notice:
      'This file contains all personal information Qx10.lol holds about you on the server, ' +
      'as required by CCPA/CPRA (Right to Know). Workspace content stored only in this browser ' +
      'localStorage (not yet migrated) is not included.',
    user: {
      sub: session.sub,
      email: session.email,
      name: session.name ?? null,
      picture: session.picture ?? null,
      sessionIssuedAt: new Date(session.iat).toISOString(),
      record: user,
    },
    events,
    workspaces: workspaceExport?.workspaces ?? [],
    dashboardLayouts: workspaceExport?.dashboardLayouts ?? {},
    prefs: workspaceExport?.prefs ?? {},
  };

  const filename = `qx10-data-export-${session.sub}-${Date.now()}.json`;
  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
