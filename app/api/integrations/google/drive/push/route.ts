import { NextResponse } from 'next/server';
import { upsertWorkspaceBackup } from '@/lib/integrations/google-drive-rest';
import { getGoogleDriveSession } from '@/lib/integrations/google-drive-session';
import { parseWorkspaceSnapshotString } from '@/lib/workspace-snapshot';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 12 * 1024 * 1024;

export async function POST(req: Request) {
  const session = await getGoogleDriveSession();
  if (!session) {
    return NextResponse.json({ error: 'not_connected' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const snapshotJson =
    typeof body === 'object' && body !== null && 'snapshotJson' in body
      ? String((body as { snapshotJson?: unknown }).snapshotJson ?? '')
      : '';

  if (!snapshotJson || snapshotJson.length > MAX_BYTES) {
    return NextResponse.json({ error: 'invalid_snapshot' }, { status: 400 });
  }

  const parsed = parseWorkspaceSnapshotString(snapshotJson);
  if (!parsed.ok) {
    return NextResponse.json({ error: 'invalid_snapshot' }, { status: 400 });
  }

  try {
    const result = await upsertWorkspaceBackup(session.accessToken, snapshotJson);
    return NextResponse.json({
      ok: true,
      fileId: result.fileId,
      fileName: result.fileName,
      contentHash: result.hash,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'drive_error';
    return NextResponse.json({ error: 'drive_failed', detail: msg.slice(0, 500) }, { status: 502 });
  }
}
