import { utcDayKey } from '@/lib/server/quota/config';

export function getMaxSignupsPerDay(): number {
  const raw = process.env.MAX_SIGNUPS_PER_DAY?.trim();
  const n = raw ? Number.parseInt(raw, 10) : 20;
  if (!Number.isFinite(n) || n < 1) return 20;
  return n;
}

export function isSignupCapEnabled(): boolean {
  return process.env.SIGNUP_CAP_DISABLED !== 'true';
}

export function utcDayStartMs(ts = Date.now()): number {
  const d = new Date(ts);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function isUserCreatedToday(createdAt: number, ts = Date.now()): boolean {
  return utcDayKey(createdAt) === utcDayKey(ts);
}

export function getInviteTokenTtlMs(): number {
  const days = Number.parseInt(process.env.INVITE_TOKEN_TTL_DAYS?.trim() || '7', 10);
  const d = Number.isFinite(days) && days > 0 ? days : 7;
  return d * 24 * 60 * 60 * 1000;
}
