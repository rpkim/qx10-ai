import { NextResponse } from 'next/server';
import { pullWorkspaceByKeyword } from '@/lib/integrations/google-drive-rest';
import { getGoogleDriveSession } from '@/lib/integrations/google-drive-session';
import { parseWorkspaceSnapshotString } from '@/lib/workspace-snapshot';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await getGoogleDriveSession();
  if (!session) {
    return NextResponse.json({ error: 'not_connected' }, { status: 401 });
  }

  const url = new URL(req.url);
  const keyword = (url.searchParams.get('keyword') ?? '').trim();
  if (!keyword) {
    return NextResponse.json({ error: 'keyword_required' }, { status: 400 });
  }

  try {
    const raw = await pullWorkspaceByKeyword(session.accessToken, keyword);
    if (!raw) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    if (!parseWorkspaceSnapshotString(raw).ok) {
      return NextResponse.json({ error: 'invalid_snapshot' }, { status: 422 });
    }
    return NextResponse.json({ snapshotJson: raw });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'drive_error';
    return NextResponse.json({ error: 'drive_failed', detail: msg.slice(0, 500) }, { status: 502 });
  }
}
