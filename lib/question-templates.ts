import type { QueryToolChoice } from '@/lib/types';

export interface QuestionTemplate {
  id: string;
  name: string;
  pattern: string;
  toolChoice?: QueryToolChoice;
  /** Follow-up / custom branch question lines saved with the template */
  followUpQuestions?: string[];
}

const STORAGE_KEY = 'qx10-question-templates';

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

export function loadQuestionTemplates(): QuestionTemplate[] {
  if (typeof window === 'undefined') return [];
  return safeParse(localStorage.getItem(STORAGE_KEY));
}

export function saveQuestionTemplates(list: QuestionTemplate[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
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
