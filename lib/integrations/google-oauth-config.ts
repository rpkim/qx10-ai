/** Scopes: identity + Drive appDataFolder only (hidden app backup area). */
export const GOOGLE_OAUTH_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive.appdata',
].join(' ');

export const GOOGLE_TOKEN_COOKIE = 'qx10_gdrive';
export const GOOGLE_OAUTH_STATE_COOKIE = 'qx10_oauth_st';
export const GOOGLE_OAUTH_NEXT_COOKIE = 'qx10_oauth_next';

export function getGoogleRedirectUri(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  if (!base) {
    throw new Error('NEXT_PUBLIC_APP_URL is required for Google OAuth');
  }
  return `${base}/api/integrations/google/callback`;
}

export function assertGoogleClientConfigured(): void {
  if (!process.env.GOOGLE_CLIENT_ID?.trim() || !process.env.GOOGLE_CLIENT_SECRET?.trim()) {
    throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set');
  }
}
