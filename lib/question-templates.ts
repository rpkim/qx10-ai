import type { QueryToolChoice } from '@/lib/types';

export interface QuestionTemplate {
  id: string;
  name: string;
  pattern: string;
  toolChoice?: QueryToolChoice;
  /** Follow-up / custom branch question lines saved with the template */
  followUpQuestions?: string[];
}

const PREFS_KEY = 'questionTemplates';
const LEGACY_STORAGE_KEY = 'qx10-question-templates';

let cache: QuestionTemplate[] | null = null;
let loadPromise: Promise<QuestionTemplate[]> | null = null;

function isToolChoice(v: unknown): v is QueryToolChoice {
  return v === 'auto' || v === 'web' || v === 'market';
}

function normalizeEntry(raw: unknown): QuestionTemplate | null {
  if (!raw || typeof raw !== 'object') return null;
  const x = raw as Record<string, unknown>;
  if (typeof x.id !== 'string' || typeof x.name !== 'string' || typeof x.pattern !== 'string') {
    return null;
  }
  const fu = x.followUpQuestions;
  const followUpQuestions = Array.isArray(fu)
    ? fu.filter((q): q is string => typeof q === 'string').map((s) => s.trim()).filter(Boolean)
    : [];
  const toolChoice: QueryToolChoice = isToolChoice(x.toolChoice) ? x.toolChoice : 'auto';
  return {
    id: x.id,
    name: x.name,
    pattern: x.pattern,
    toolChoice,
    followUpQuestions,
  };
}

function safeParse(json: string | null): QuestionTemplate[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json) as unknown;
    if (!Array.isArray(v)) return [];
    return v.map(normalizeEntry).filter((x): x is QuestionTemplate => x != null);
  } catch {
    return [];
  }
}

function parsePrefsList(raw: unknown): QuestionTemplate[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeEntry).filter((x): x is QuestionTemplate => x != null);
}

function loadLegacyFromLocalStorage(): QuestionTemplate[] {
  if (typeof window === 'undefined') return [];
  return safeParse(localStorage.getItem(LEGACY_STORAGE_KEY));
}

async function persistToServer(list: QuestionTemplate[]): Promise<void> {
  const { fetchUserPrefs, saveUserPrefs } = await import('./workspace-api');
  const prefs = await fetchUserPrefs();
  await saveUserPrefs({ ...prefs, [PREFS_KEY]: list });
}

function persistTemplates(list: QuestionTemplate[]): void {
  cache = list;
  void persistToServer(list).catch(() => {
    /* server save best-effort */
  });
}

export function loadQuestionTemplates(): QuestionTemplate[] {
  if (cache) return cache;
  if (typeof window === 'undefined') return [];
  return loadLegacyFromLocalStorage();
}

export async function loadQuestionTemplatesAsync(): Promise<QuestionTemplate[]> {
  if (cache) return cache;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    if (typeof window === 'undefined') return [];

    const { fetchUserPrefs } = await import('./workspace-api');
    const prefs = await fetchUserPrefs();
    const fromServer = parsePrefsList(prefs[PREFS_KEY]);
    if (fromServer.length > 0) {
      cache = fromServer;
      return fromServer;
    }

    const legacy = loadLegacyFromLocalStorage();
    if (legacy.length > 0) {
      cache = legacy;
      void persistToServer(legacy).then(() => {
        try {
          localStorage.removeItem(LEGACY_STORAGE_KEY);
        } catch {
          /* ignore */
        }
      });
      return legacy;
    }

    cache = [];
    return [];
  })();

  try {
    return await loadPromise;
  } finally {
    loadPromise = null;
  }
}

export function saveQuestionTemplates(list: QuestionTemplate[]) {
  persistTemplates(list);
}

export function upsertQuestionTemplate(entry: {
  id?: string;
  name: string;
  pattern: string;
  toolChoice?: QueryToolChoice;
  followUpQuestions?: string[];
}): string {
  const list = loadQuestionTemplates();
  const id = entry.id ?? `qt-${Date.now()}`;
  const filtered = list.filter((t) => t.id !== id);
  const followUps = (entry.followUpQuestions ?? [])
    .map((s) => s.trim())
    .filter(Boolean);
  filtered.push({
    id,
    name: entry.name.trim() || 'Untitled',
    pattern: entry.pattern,
    toolChoice: entry.toolChoice ?? 'auto',
    followUpQuestions: followUps,
  });
  saveQuestionTemplates(filtered);
  return id;
}

export function deleteQuestionTemplate(id: string): void {
  const list = loadQuestionTemplates().filter((t) => t.id !== id);
  saveQuestionTemplates(list);
}

/** Unique variable keys in order of first appearance: `{{foo}}` → `foo` */
export function parseTemplateVariableKeys(pattern: string): string[] {
  const re = /\{\{([^{}]+)\}\}/g;
  const order: string[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(pattern)) !== null) {
    const key = m[1].trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    order.push(key);
  }
  return order;
}

export function substituteTemplate(
  pattern: string,
  values: Record<string, string>
): string {
  return pattern.replace(/\{\{([^{}]+)\}\}/g, (_, raw: string) => {
    const k = raw.trim();
    return values[k] ?? '';
  });
}
