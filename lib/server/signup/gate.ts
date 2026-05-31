import { isAdminEmail } from '@/lib/auth/admin';
import { getAnalyticsStore } from '@/lib/server/analytics/store';
import { getInviteTokenTtlMs, getMaxSignupsPerDay, isSignupCapEnabled, utcDayStartMs } from '@/lib/server/signup/config';
import { getWaitlistStore } from '@/lib/server/waitlist/store';
import type { WaitlistEntry } from '@/lib/server/waitlist/types';
import { generateInviteToken, hashInviteToken } from '@/lib/server/waitlist/types';

export type SignupGateResult =
  | { allowed: true; reason: 'existing_user' | 'admin_email' | 'under_cap' | 'valid_invite' }
  | { allowed: false; reason: 'daily_cap' | 'waitlisted' };

export async function evaluateNewSignup(input: {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
  inviteToken?: string | null;
  ts?: number;
}): Promise<SignupGateResult> {
  const ts = input.ts ?? Date.now();
  const store = getAnalyticsStore();
  const existing = await store.getUser(input.sub);
  if (existing) return { allowed: true, reason: 'existing_user' };

  if (isAdminEmail(input.email)) return { allowed: true, reason: 'admin_email' };

  if (!isSignupCapEnabled()) return { allowed: true, reason: 'under_cap' };

  const token = input.inviteToken?.trim();
  if (token) {
    const consumed = await getWaitlistStore().consumeInviteToken({
      token,
      email: input.email,
      ts,
    });
    if (consumed.ok) return { allowed: true, reason: 'valid_invite' };
  }

  const signupsToday = await store.countUsersCreatedSince(utcDayStartMs(ts));
  if (signupsToday < getMaxSignupsPerDay()) {
    return { allowed: true, reason: 'under_cap' };
  }

  await getWaitlistStore().upsertPending({
    sub: input.sub,
    email: input.email,
    name: input.name,
    picture: input.picture,
    ts,
  });
  return { allowed: false, reason: 'daily_cap' };
}

export async function completeSignupAfterAllow(input: {
  email: string;
  ts: number;
}): Promise<void> {
  await getWaitlistStore().markJoined(input.email, input.ts);
}

export async function createInviteForWaitlistEntry(input: {
  id: number;
  invitedByEmail: string;
  ts?: number;
}): Promise<{ token: string; entry: WaitlistEntry }> {
  const ts = input.ts ?? Date.now();
  const token = generateInviteToken();
  const entry = await getWaitlistStore().markInvited({
    id: input.id,
    invitedBy: input.invitedByEmail,
    tokenHash: hashInviteToken(token),
    expiresAt: ts + getInviteTokenTtlMs(),
    ts,
  });
  return { token, entry };
}

export async function getSignupStats(ts = Date.now()) {
  const store = getAnalyticsStore();
  const signupsToday = await store.countUsersCreatedSince(utcDayStartMs(ts));
  const maxPerDay = getMaxSignupsPerDay();
  const waitlist = await getWaitlistStore().list({ limit: 500 });
  return {
    signupsToday,
    maxPerDay,
    remaining: Math.max(0, maxPerDay - signupsToday),
    waitlistPending: waitlist.filter((e) => e.status === 'pending').length,
    waitlistInvited: waitlist.filter((e) => e.status === 'invited').length,
  };
}
