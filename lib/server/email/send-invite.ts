import { getInviteTokenTtlMs } from '@/lib/server/signup/config';

function appBaseUrl(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  if (!base) throw new Error('NEXT_PUBLIC_APP_URL is required to send invite emails');
  return base;
}

function emailFrom(): string {
  return process.env.EMAIL_FROM?.trim() || 'Qx10 <onboarding@resend.dev>';
}

export async function sendWaitlistInviteEmail(input: {
  to: string;
  name?: string;
  inviteToken: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured');

  const loginUrl = `${appBaseUrl()}/login?invite=${encodeURIComponent(input.inviteToken)}`;
  const displayName = input.name?.trim() || 'there';
  const ttlDays = Math.max(1, Math.round(getInviteTokenTtlMs() / (24 * 60 * 60 * 1000)));

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: emailFrom(),
      to: [input.to],
      subject: 'Your Qx10 invite is ready',
      html: `
        <p>Hi ${escapeHtml(displayName)},</p>
        <p>You're invited to join <strong>Qx10</strong>. Daily sign-ups were full when you tried earlier — use this link to complete Google sign-in:</p>
        <p><a href="${loginUrl}">${loginUrl}</a></p>
        <p>This invite expires in ${ttlDays} day(s) and works only for <strong>${escapeHtml(input.to)}</strong>.</p>
        <p>— Qx10 team</p>
      `,
      text: `Hi ${displayName},\n\nYou're invited to join Qx10. Open this link to sign in with Google:\n${loginUrl}\n\nExpires in ${ttlDays} day(s). Use the same email: ${input.to}.`,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Resend failed (${res.status}): ${detail.slice(0, 300)}`);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
