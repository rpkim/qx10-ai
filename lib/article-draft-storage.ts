/**
 * Article drafts are per workspace keyword.
 * Primary store is the server DB; localStorage is a cache / offline fallback.
 */

export interface StoredArticleMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export interface StoredArticleDraft {
  title: string;
  subtitle: string;
  body: string;
  messages: StoredArticleMessage[];
  updatedAt: number;
}

const STORAGE_PREFIX = 'qx10.article.v1:';

function storageKey(keyword: string): string {
  return `${STORAGE_PREFIX}${keyword.trim().toLowerCase()}`;
}

function isMessage(value: unknown): value is StoredArticleMessage {
  const m = value as Record<string, unknown>;
  return (
    !!m &&
    typeof m.id === 'string' &&
    (m.role === 'user' || m.role === 'assistant') &&
    typeof m.content === 'string'
  );
}

/** Normalize unknown JSON into a StoredArticleDraft, or null if empty/invalid. */
export function parseStoredArticleDraft(raw: unknown): StoredArticleDraft | null {
  if (!raw || typeof raw !== 'object') return null;
  const parsed = raw as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  const title = str(parsed.title);
  const subtitle = str(parsed.subtitle);
  const body = str(parsed.body);
  const messages = Array.isArray(parsed.messages) ? parsed.messages.filter(isMessage) : [];
  const updatedAt = typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0;
  if (!title && !subtitle && !body && messages.length === 0) return null;
  return { title, subtitle, body, messages, updatedAt };
}

export function loadArticleDraft(keyword: string): StoredArticleDraft | null {
  if (typeof window === 'undefined' || !keyword.trim()) return null;
  try {
    const raw = window.localStorage.getItem(storageKey(keyword));
    if (!raw) return null;
    return parseStoredArticleDraft(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveArticleDraft(keyword: string, draft: StoredArticleDraft): boolean {
  if (typeof window === 'undefined' || !keyword.trim()) return false;
  try {
    window.localStorage.setItem(storageKey(keyword), JSON.stringify(draft));
    return true;
  } catch {
    // Quota exceeded or storage disabled — the editor keeps working in memory.
    return false;
  }
}

export function clearArticleDraft(keyword: string): void {
  if (typeof window === 'undefined' || !keyword.trim()) return;
  try {
    window.localStorage.removeItem(storageKey(keyword));
  } catch {
    // ignore
  }
}

/** Enumerate every local article draft (for one-time local → server migration). */
export function collectLocalArticleDrafts(): Record<string, StoredArticleDraft> {
  if (typeof window === 'undefined') return {};
  const out: Record<string, StoredArticleDraft> = {};
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key?.startsWith(STORAGE_PREFIX)) continue;
      const keyword = key.slice(STORAGE_PREFIX.length);
      if (!keyword) continue;
      const draft = loadArticleDraft(keyword);
      if (draft) out[keyword] = draft;
    }
  } catch {
    // ignore
  }
  return out;
}
