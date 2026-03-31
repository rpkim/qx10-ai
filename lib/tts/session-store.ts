import { randomUUID } from 'crypto';

type Entry = { text: string; expiresAt: number };

const TTL_MS = 2 * 60 * 1000;
const store = new Map<string, Entry>();

function sweep(now = Date.now()) {
  for (const [k, v] of store.entries()) {
    if (v.expiresAt <= now) store.delete(k);
  }
}

export function createTtsSession(text: string): string {
  sweep();
  const id = randomUUID();
  store.set(id, { text, expiresAt: Date.now() + TTL_MS });
  return id;
}

export function consumeTtsSession(id: string): string | null {
  sweep();
  const entry = store.get(id);
  if (!entry) return null;
  store.delete(id);
  return entry.text;
}

