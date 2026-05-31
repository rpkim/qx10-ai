export type UserTier = 'free' | 'premium' | 'admin';

export const USER_TIERS: UserTier[] = ['free', 'premium', 'admin'];

export function parseUserTier(raw: string | null | undefined): UserTier {
  if (raw === 'premium' || raw === 'admin') return raw;
  return 'free';
}

export function tierLabel(tier: UserTier): string {
  switch (tier) {
    case 'premium':
      return 'Premium';
    case 'admin':
      return 'Admin';
    default:
      return 'Free';
  }
}

export function isElevatedTier(tier: UserTier | undefined): boolean {
  return tier === 'premium' || tier === 'admin';
}
