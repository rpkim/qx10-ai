import { NextResponse } from 'next/server';
import { deleteWorkspaceBackupByKeyword } from '@/lib/integrations/google-drive-rest';
import { getGoogleDriveSession } from '@/lib/integrations/google-drive-session';

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

  const keyword =
    typeof body === 'object' && body !== null && 'keyword' in body
      ? String((body as { keyword?: unknown }).keyword ?? '').trim()
      : '';

  if (!keyword) {
    return NextResponse.json({ error: 'keyword_required' }, { status: 400 });
  }

  try {
    const ok = await deleteWorkspaceBackupByKeyword(session.accessToken, keyword);
    return NextResponse.json({ ok });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'drive_error';
    return NextResponse.json({ error: 'drive_failed', detail: msg.slice(0, 500) }, { status: 502 });
  }
}
