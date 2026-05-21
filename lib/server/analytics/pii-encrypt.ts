/**
 * Application-layer field-level encryption for PII stored in the analytics DB.
 *
 * Encrypted values are tagged with the prefix "enc:v1:" so they can be
 * distinguished from legacy plaintext rows during a migration window — the
 * decrypt helpers fall back to returning the raw value as-is for any string
 * that does not carry the prefix.
 *
 * Key material: QX10_PII_SECRET (preferred) → QX10_AUTH_SECRET → AUTH_SECRET
 * → hardcoded dev-only sentinel.  Set QX10_PII_SECRET in production.
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGO = 'aes-256-gcm' as const;
const PREFIX = 'enc:v1:';

let _cachedKey: Buffer | undefined;

function deriveKey(): Buffer {
  if (_cachedKey) return _cachedKey;
  const secret =
    process.env.QX10_PII_SECRET ||
    process.env.QX10_AUTH_SECRET ||
    process.env.AUTH_SECRET ||
    'dev-only-set-QX10_PII_SECRET-in-production';
  _cachedKey = scryptSync(secret, 'qx10-pii-field-v1', 32);
  return _cachedKey;
}

/** Encrypt a PII string. Returns an opaque "enc:v1:<base64url>" token. */
export function encryptField(value: string): string {
  const iv = randomBytes(12);
  const key = deriveKey();
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(Buffer.from(value, 'utf8')), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, enc]).toString('base64url');
}

/**
 * Decrypt a field encrypted by `encryptField`.
 * Returns `undefined` on failure.
 * Returns the raw string if it does not carry the "enc:v1:" prefix
 * (graceful fallback for pre-encryption plaintext rows).
 */
export function decryptField(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  if (!value.startsWith(PREFIX)) return value;
  try {
    const buf = Buffer.from(value.slice(PREFIX.length), 'base64url');
    if (buf.length < 28) return undefined;
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const key = deriveKey();
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
    return dec.toString('utf8');
  } catch {
    return undefined;
  }
}

/** Like `decryptField` but returns `fallback` instead of `undefined`. */
export function decryptFieldOr(value: string | null | undefined, fallback: string): string {
  return decryptField(value) ?? fallback;
}
