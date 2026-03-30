import { NextResponse } from 'next/server';
import { getGoogleDriveSession } from '@/lib/integrations/google-drive-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getGoogleDriveSession();
  if (!session) {
    return NextResponse.json({ connected: false, email: null, name: null });
  }
  return NextResponse.json({
    connected: true,
    email: session.email ?? null,
    name: session.name ?? null,
  });
}
