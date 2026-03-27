'use client';

const DB_NAME = 'qx10-byok-db';
const STORE_NAME = 'secrets';
const RECORD_KEY = 'gemini-api-key-v1';
const PBKDF2_ITERATIONS = 210_000;

interface EncryptedRecord {
  v: 1;
  salt: string;
  iv: string;
  cipher: string;
  updatedAt: number;
}

function toB64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 1) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = window.indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open IndexedDB'));
  });
}

async function deriveAesKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function saveGeminiKeyEncrypted(apiKey: string, passphrase: string): Promise<void> {
  const normalized = apiKey.trim();
  if (!normalized) throw new Error('API key is required.');
  if (!passphrase.trim()) throw new Error('Passphrase is required.');

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(passphrase, salt);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(normalized)
  );

  const record: EncryptedRecord = {
    v: 1,
    salt: toB64(salt),
    iv: toB64(iv),
    cipher: toB64(new Uint8Array(encrypted)),
    updatedAt: Date.now(),
  };

  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(record, RECORD_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Failed to save API key'));
    tx.onabort = () => reject(tx.error ?? new Error('Save transaction aborted'));
  });
  db.close();
}

export async function hasEncryptedGeminiKey(): Promise<boolean> {
  const db = await openDb();
  const value = await new Promise<unknown>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(RECORD_KEY);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to read key state'));
  });
  db.close();
  return !!value;
}

export async function loadGeminiKeyEncrypted(passphrase: string): Promise<string> {
  if (!passphrase.trim()) throw new Error('Passphrase is required.');
  const db = await openDb();
  const record = (await new Promise<unknown>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(RECORD_KEY);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to load key record'));
  })) as EncryptedRecord | undefined;
  db.close();

  if (!record) throw new Error('No stored Gemini key found.');
  if (record.v !== 1) throw new Error('Unsupported key record version.');

  try {
    const salt = fromB64(record.salt);
    const iv = fromB64(record.iv);
    const cipher = fromB64(record.cipher);
    const key = await deriveAesKey(passphrase, salt);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
    return new TextDecoder().decode(plain).trim();
  } catch {
    throw new Error('Failed to decrypt key. Check passphrase.');
  }
}

export async function clearGeminiKeyEncrypted(): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(RECORD_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Failed to clear API key'));
    tx.onabort = () => reject(tx.error ?? new Error('Clear transaction aborted'));
  });
  db.close();
}
