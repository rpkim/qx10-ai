import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { cookies } from 'next/headers';

/**
 * Sign-in session cookie. Certifies that this browser is signed in as <email>.
 */
export const AUTH_SESSION_COOKIE = 'qx10_session';
export const AUTH_OAUTH_STATE_COOKIE = 'qx10_auth_st';
export const AUTH_OAUTH_NEXT_COOKIE = 'qx10_auth_next';
export const AUTH_OAUTH_INVITE_COOKIE = 'qx10_auth_invite';

/** 30 days. */
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const ALGO = 'aes-256-gcm';

function deriveKey(): Buffer {
  const secret =
    process.env.QX10_AUTH_SECRET ||
    process.env.QX10_GOOGLE_TOKEN_SECRET ||
    process.env.AUTH_SECRET;
  if (!secret) {
    // Refuse to silently sign sessions with a well-known key in production —
    // that string is public (it's in the source), so anyone could forge a
    // session cookie for any account, including admin. Callers already
    // handle this failing (sealAuthSession's caller redirects to an error
    // page; openAuthSession treats a throw the same as an invalid cookie),
    // so this fails closed instead of failing insecure.
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'QX10_AUTH_SECRET (or AUTH_SECRET) must be set in production — refusing to sign/verify session cookies with an insecure default key.'
      );
    }
    return scryptSync('dev-only-set-QX10_AUTH_SECRET', 'qx10-auth-session', 32);
  }
  return scryptSync(secret, 'qx10-auth-session', 32);
}

export type AuthSession = {
  /** Stable Google subject identifier. */
  sub: string;
  email: string;
  name?: string;
  picture?: string;
  /** Issued-at (epoch ms). */
  iat: number;
};

export function sealAuthSession(payload: Omit<AuthSession, 'iat'> & { iat?: number }): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, deriveKey(), iv);
  const body: AuthSession = {
    sub: payload.sub,
    email: payload.email,
    name: payload.name,
    picture: payload.picture,
    iat: payload.iat ?? Date.now(),
  };
  const json = Buffer.from(JSON.stringify(body), 'utf8');
  const enc = Buffer.concat([cipher.update(json), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64url');
}

export function openAuthSession(sealed: string | undefined | null): AuthSession | null {
  if (!sealed) return null;
  try {
    const buf = Buffer.from(sealed, 'base64url');
    if (buf.length < 28) return null;
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const decipher = createDecipheriv(ALGO, deriveKey(), iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
    const o = JSON.parse(dec.toString('utf8')) as AuthSession;
    if (!o || typeof o.sub !== 'string' || typeof o.email !== 'string') return null;
    return o;
  } catch {
    return null;
  }
}

/** Read the current sign-in session from cookies (server-only). */
export async function getAuthSession(): Promise<AuthSession | null> {
  const jar = await cookies();
  return openAuthSession(jar.get(AUTH_SESSION_COOKIE)?.value);
}

export const authCookieBase = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

export const authCookieMaxAge = SESSION_MAX_AGE_SECONDS;
