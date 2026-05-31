import type { UserTier } from '@/lib/server/quota/tiers';

export type UserAccountStatus = 'active' | 'suspended';

export type QueryQuotaSnapshot = {
  dailyCount: number;
  dailyLimit: number;
  remaining: number;
  resetsAt: number;
  status: UserAccountStatus;
  tier: UserTier;
  freeTierLimit: number;
  premiumTierLimit: number;
};

export type ConsumeQueryResult =
  | { ok: true; quota: QueryQuotaSnapshot }
  | { ok: false; code: 'DAILY_QUOTA_EXCEEDED' | 'SUSPENDED' | 'USER_NOT_FOUND'; quota: QueryQuotaSnapshot };
