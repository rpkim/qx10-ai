import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/session';
import { getAnalyticsStore } from '@/lib/server/analytics/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * "Right to Know" data export. Returns the full set of personal information
 * we hold about the requesting user, in a portable JSON format.
 *
 * - Identity comes from the sealed session cookie (verified by AES-GCM).
 * - Events are scoped to this user's `sub` only.
 * - The response is sent with a Content-Disposition that prompts a download.
 */
export async function GET() {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const store = getAnalyticsStore();
  let user = null;
  let events: unknown[] = [];
  try {
    [user, events] = await Promise.all([
      store.getUser(session.sub),
      store.listEvents({ sub: session.sub, limit: 5000 }),
    ]);
  } catch (e) {
    console.error('[export-data] failed', e);
    return NextResponse.json({ error: 'store_error' }, { status: 500 });
  }

  const payload = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    notice:
      'This file contains all personal information Qx10.lol holds about you on the server, ' +
      'as required by CCPA/CPRA (Right to Know). Workspace content stored in your browser ' +
      'localStorage or in your own Google Drive app-data folder is not included here — those ' +
      'are accessible directly from the respective surfaces.',
    user: {
      sub: session.sub,
      email: session.email,
      name: session.name ?? null,
      picture: session.picture ?? null,
      sessionIssuedAt: new Date(session.iat).toISOString(),
      record: user,
    },
    events,
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
