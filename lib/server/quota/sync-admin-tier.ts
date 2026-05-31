import { isAdminEmail } from '@/lib/auth/admin';
import type { AnalyticsStore, UserRecord } from '@/lib/server/analytics/types';

/** ADMIN_EMAILS users always get Admin tier (200/day). Upgrades only — never downgrades. */
export async function ensureAdminTierForUser(
  store: AnalyticsStore,
  user: UserRecord
): Promise<UserRecord> {
  if (!isAdminEmail(user.email)) return user;
  if (user.tier === 'admin') return user;
  return store.updateUserTier(user.sub, 'admin');
}

export function tierForEmailOnSignIn(
  email: string,
  existingTier?: UserRecord['tier']
): UserRecord['tier'] {
  if (isAdminEmail(email)) return 'admin';
  return existingTier ?? 'free';
}
