import type { UserTier } from '@/lib/server/quota/tiers';
import { isElevatedTier, parseUserTier } from '@/lib/server/quota/tiers';

export function getDefaultDailyQueryLimit(): number {
  const raw = process.env.DAILY_QUERY_LIMIT?.trim();
  const n = raw ? Number.parseInt(raw, 10) : 80;
  if (!Number.isFinite(n) || n < 1) return 80;
  return n;
}

/** Daily limit for Premium-tier and Admin-tier users. */
export function getPremiumTierDailyQueryLimit(): number {
  const raw = process.env.PREMIUM_DAILY_QUERY_LIMIT?.trim();
  const n = raw ? Number.parseInt(raw, 10) : 200;
  if (!Number.isFinite(n) || n < 1) return 200;
  return n;
}

export function utcDayKey(ts = Date.now()): string {
  return new Date(ts).toISOString().slice(0, 10);
}

export function nextUtcDayStartMs(ts = Date.now()): number {
  const d = new Date(ts);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
}

export function resolveDailyLimitForTier(tier: UserTier | undefined): number {
  return isElevatedTier(tier) ? getPremiumTierDailyQueryLimit() : getDefaultDailyQueryLimit();
}

export function resolveUserDailyLimit(user: {
  tier?: UserTier | string | null;
  dailyQueryLimit?: number | null;
}): number {
  const tier = parseUserTier(user.tier ?? undefined);
  return resolveDailyLimitForTier(tier);
}
