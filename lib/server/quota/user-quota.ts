import {
  getDefaultDailyQueryLimit,
  getPremiumTierDailyQueryLimit,
  nextUtcDayStartMs,
  resolveUserDailyLimit,
  utcDayKey,
} from '@/lib/server/quota/config';
import { parseUserTier } from '@/lib/server/quota/tiers';
import type { ConsumeQueryResult, QueryQuotaSnapshot } from '@/lib/server/quota/types';
import type { UserRecord } from '@/lib/server/analytics/types';

export function buildQueryQuotaSnapshot(user: UserRecord, ts = Date.now()): QueryQuotaSnapshot {
  const day = utcDayKey(ts);
  const count =
    user.queryQuotaDay === day ? Math.max(0, user.dailyQueryCount ?? 0) : 0;
  const tier = parseUserTier(user.tier);
  const dailyLimit = resolveUserDailyLimit(user);
  const status = user.status === 'suspended' ? 'suspended' : 'active';
  return {
    dailyCount: count,
    dailyLimit,
    remaining: Math.max(0, dailyLimit - count),
    resetsAt: nextUtcDayStartMs(ts),
    status,
    tier,
    freeTierLimit: getDefaultDailyQueryLimit(),
    premiumTierLimit: getPremiumTierDailyQueryLimit(),
  };
}

export function tryConsumeDailyQueryOnUser(
  user: UserRecord,
  input: {
    sub: string;
    email: string;
    keyword: string;
    goal: string;
    model?: string;
    ts: number;
  }
): { user: UserRecord; result: ConsumeQueryResult } {
  const day = utcDayKey(input.ts);
  let count = user.queryQuotaDay === day ? Math.max(0, user.dailyQueryCount ?? 0) : 0;
  const dailyLimit = resolveUserDailyLimit(user);
  const status = user.status === 'suspended' ? 'suspended' : 'active';
  const tier = parseUserTier(user.tier);
  const quotaBase: QueryQuotaSnapshot = {
    dailyCount: count,
    dailyLimit,
    remaining: Math.max(0, dailyLimit - count),
    resetsAt: nextUtcDayStartMs(input.ts),
    status,
    tier,
    freeTierLimit: getDefaultDailyQueryLimit(),
    premiumTierLimit: getPremiumTierDailyQueryLimit(),
  };

  if (status === 'suspended') {
    return { user, result: { ok: false, code: 'SUSPENDED', quota: quotaBase } };
  }

  if (count >= dailyLimit) {
    return {
      user,
      result: { ok: false, code: 'DAILY_QUOTA_EXCEEDED', quota: quotaBase },
    };
  }

  count += 1;
  const nextUser: UserRecord = {
    ...user,
    dailyQueryCount: count,
    queryQuotaDay: day,
    lastSeenAt: Math.max(user.lastSeenAt, input.ts),
  };
  const quota: QueryQuotaSnapshot = {
    ...quotaBase,
    dailyCount: count,
    remaining: Math.max(0, dailyLimit - count),
  };
  return { user: nextUser, result: { ok: true, quota } };
}
