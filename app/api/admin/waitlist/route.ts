import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/auth/require-admin';
import { getWaitlistStore } from '@/lib/server/waitlist/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.res;

  try {
    const entries = await getWaitlistStore().list({ limit: 500 });
    return NextResponse.json({ entries });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
