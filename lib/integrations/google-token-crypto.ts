import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGO = 'aes-256-gcm';

function deriveKey(): Buffer {
  const secret =
    process.env.QX10_GOOGLE_TOKEN_SECRET ||
    process.env.AUTH_SECRET ||
    'dev-only-set-QX10_GOOGLE_TOKEN_SECRET';
  return scryptSync(secret, 'qx10-google-drive', 32);
}

export type SealedGoogleTokens = {
  refresh_token: string;
  email?: string;
  name?: string;
};

export function sealGoogleTokens(payload: SealedGoogleTokens): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, deriveKey(), iv);
  const json = Buffer.from(JSON.stringify(payload), 'utf8');
  const enc = Buffer.concat([cipher.update(json), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64url');
}

export function openGoogleTokens(sealed: string): SealedGoogleTokens | null {
  try {
    const buf = Buffer.from(sealed, 'base64url');
    if (buf.length < 28) return null;
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const decipher = createDecipheriv(ALGO, deriveKey(), iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
    const o = JSON.parse(dec.toString('utf8')) as SealedGoogleTokens;
    if (!o || typeof o.refresh_token !== 'string') return null;
    return o;
  } catch {
    return null;
  }
}
