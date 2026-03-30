import { NextResponse } from 'next/server';
import { getGoogleDriveSession } from '@/lib/integrations/google-drive-session';
import { renameWorkspaceBackupKeyword } from '@/lib/integrations/google-drive-rest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

  const oldKeyword =
    typeof body === 'object' && body !== null && 'oldKeyword' in body
      ? String((body as { oldKeyword?: unknown }).oldKeyword ?? '').trim()
      : '';
  const newKeyword =
    typeof body === 'object' && body !== null && 'newKeyword' in body
      ? String((body as { newKeyword?: unknown }).newKeyword ?? '').trim()
      : '';

  if (!oldKeyword || !newKeyword) {
    return NextResponse.json({ error: 'oldKeyword and newKeyword are required' }, { status: 400 });
  }

  try {
    await renameWorkspaceBackupKeyword(session.accessToken, oldKeyword, newKeyword);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'drive_error';
    return NextResponse.json({ error: 'drive_failed', detail: msg.slice(0, 500) }, { status: 502 });
  }
}
