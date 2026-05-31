const GEMINI_KEY_STORAGE = 'qx10.byok.gemini.v1';
const WRAP_KEY_STORAGE = 'qx10.byok.wrapKey.v1';

type EncPayload = {
  v: 1;
  iv: string;
  ct: string;
};

function b64FromBytes(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function bytesFromB64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function getOrCreateWrapKey(): Promise<CryptoKey> {
  const stored = localStorage.getItem(WRAP_KEY_STORAGE);
  if (stored) {
    const raw = bytesFromB64(stored);
    return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
  }
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]);
  const exported = new Uint8Array(await crypto.subtle.exportKey('raw', key));
  localStorage.setItem(WRAP_KEY_STORAGE, b64FromBytes(exported));
  return key;
}

export function hasStoredGeminiApiKey(): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem(GEMINI_KEY_STORAGE);
}

export async function saveGeminiApiKey(plain: string): Promise<void> {
  const trimmed = plain.trim();
  if (!trimmed) throw new Error('empty_key');
  if (!/^AIza[0-9A-Za-z_-]{20,}$/.test(trimmed)) {
    throw new Error('invalid_format');
  }
  const key = await getOrCreateWrapKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(trimmed))
  );
  const payload: EncPayload = { v: 1, iv: b64FromBytes(iv), ct: b64FromBytes(ct) };
  localStorage.setItem(GEMINI_KEY_STORAGE, JSON.stringify(payload));
}

export async function loadGeminiApiKey(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(GEMINI_KEY_STORAGE);
  if (!raw) return null;
  try {
    const payload = JSON.parse(raw) as EncPayload;
    if (payload.v !== 1 || !payload.iv || !payload.ct) return null;
    const key = await getOrCreateWrapKey();
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: bytesFromB64(payload.iv) },
      key,
      bytesFromB64(payload.ct)
    );
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}

export async function clearGeminiApiKey(): Promise<void> {
  localStorage.removeItem(GEMINI_KEY_STORAGE);
}

export function maskGeminiApiKey(key: string): string {
  if (key.length <= 8) return '••••••••';
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}

export const GEMINI_BYOK_HEADER = 'X-Qx10-Gemini-Api-Key';
