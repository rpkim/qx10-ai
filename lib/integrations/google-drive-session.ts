import { cookies } from 'next/headers';
import { GOOGLE_TOKEN_COOKIE } from './google-oauth-config';
import { openGoogleTokens } from './google-token-crypto';
import { refreshAccessToken } from './google-oauth-exchange';

export type GoogleDriveSession = {
  accessToken: string;
  email?: string;
  name?: string;
};

/** Uses refresh token from httpOnly cookie; does not rewrite the cookie (avoids Route Handler cookie edge cases). */
export async function getGoogleDriveSession(): Promise<GoogleDriveSession | null> {
  const jar = await cookies();
  const raw = jar.get(GOOGLE_TOKEN_COOKIE)?.value;
  if (!raw) return null;
  const opened = openGoogleTokens(raw);
  if (!opened) return null;

  try {
    const refreshed = await refreshAccessToken(opened.refresh_token);
    return {
      accessToken: refreshed.access_token,
      email: opened.email,
      name: opened.name,
    };
  } catch {
    return null;
  }
}
