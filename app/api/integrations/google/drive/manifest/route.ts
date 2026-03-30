import { NextResponse } from 'next/server';
import { loadManifest } from '@/lib/integrations/google-drive-rest';
import { getGoogleDriveSession } from '@/lib/integrations/google-drive-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getGoogleDriveSession();
  if (!session) {
    return NextResponse.json({ error: 'not_connected' }, { status: 401 });
  }

  try {
    const manifest = await loadManifest(session.accessToken);
    return NextResponse.json({ manifest });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'drive_error';
    return NextResponse.json({ error: 'drive_failed', detail: msg.slice(0, 500) }, { status: 502 });
  }
}
