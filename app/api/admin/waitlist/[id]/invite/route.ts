import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/auth/require-admin';
import { sendWaitlistInviteEmail } from '@/lib/server/email/send-invite';
import { createInviteForWaitlistEntry } from '@/lib/server/signup/gate';
import { getWaitlistStore } from '@/lib/server/waitlist/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.res;

  const { id: idRaw } = await ctx.params;
  const id = Number.parseInt(idRaw, 10);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  try {
    const entries = await getWaitlistStore().list({ limit: 500 });
    const entry = entries.find((e) => e.id === id);
    if (!entry) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    if (entry.status === 'joined') {
      return NextResponse.json({ error: 'already_joined' }, { status: 400 });
    }

    const { token, entry: invited } = await createInviteForWaitlistEntry({
      id: entry.id,
      invitedByEmail: guard.session.email,
    });

    await sendWaitlistInviteEmail({
      to: entry.email,
      name: entry.name,
      inviteToken: token,
    });

    return NextResponse.json({ ok: true, entry: invited });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[admin/waitlist/invite]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
