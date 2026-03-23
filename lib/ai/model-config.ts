/**
 * Server-only: builds the model catalog from environment variables.
 */

export type AiProviderId = 'openai' | 'gemini';

export interface CatalogOption {
  /** Stable id, usually `provider:modelId` */
  id: string;
  provider: AiProviderId;
  model: string;
  label: string;
}

export interface AiModelCatalog {
  defaultChoice: string;
  options: CatalogOption[];
}

function parseCommaList(s: string | undefined, fallback: string[]): string[] {
  if (!s?.trim()) return fallback;
  const parts = s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  return parts.length ? parts : fallback;
}

function dedupeById(options: CatalogOption[]): CatalogOption[] {
  const seen = new Set<string>();
  return options.filter((o) => (seen.has(o.id) ? false : (seen.add(o.id), true)));
}

function resolveDefaultChoice(options: CatalogOption[]): string {
  if (options.length === 0) return '';
  const envDefault = process.env.AI_DEFAULT?.trim();
  if (envDefault && options.some((o) => o.id === envDefault)) return envDefault;
  if (envDefault?.includes(':')) {
    const [p, ...rest] = envDefault.split(':');
    const model = rest.join(':').trim();
    if ((p === 'openai' || p === 'gemini') && model) {
      const id = `${p}:${model}`;
      if (options.some((o) => o.id === id)) return id;
    }
  }
  return options[0].id;
}

/**
 * Optional JSON array override. Example:
 * `[{"id":"openai:gpt-4o-mini","provider":"openai","model":"gpt-4o-mini","label":"GPT-4o mini"}]`
 */
function catalogFromJsonOverride(
  openaiKey: boolean,
  geminiKey: boolean
): CatalogOption[] | null {
  const raw = process.env.AI_MODEL_OPTIONS?.trim();
  if (!raw) return null;
  try {
    const arr = JSON.parse(raw) as unknown[];
    if (!Array.isArray(arr)) return null;
    const out: CatalogOption[] = [];
    for (const item of arr) {
      if (!item || typeof item !== 'object') continue;
      const o = item as Record<string, unknown>;
      const provider = o.provider;
      const model = o.model;
      if (provider !== 'openai' && provider !== 'gemini') continue;
      if (typeof model !== 'string' || !model.trim()) continue;
      if (provider === 'openai' && !openaiKey) continue;
      if (provider === 'gemini' && !geminiKey) continue;
      const id =
        typeof o.id === 'string' && o.id.trim()
          ? o.id.trim()
          : `${provider}:${model.trim()}`;
      const label =
        typeof o.label === 'string' && o.label.trim() ? o.label.trim() : model.trim();
      out.push({ id, provider, model: model.trim(), label });
    }
    return dedupeById(out);
  } catch {
    return null;
  }
}

export function readGeminiApiKey(): string | undefined {
  return (
    process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim()
  );
}

export function buildModelCatalog(): AiModelCatalog {
  const openaiKey = !!process.env.OPENAI_API_KEY?.trim();
  const geminiKey = !!readGeminiApiKey();

  const fromJson = catalogFromJsonOverride(openaiKey, geminiKey);
  if (fromJson && fromJson.length > 0) {
    return {
      options: fromJson,
      defaultChoice: resolveDefaultChoice(fromJson),
    };
  }

  const options: CatalogOption[] = [];

  if (openaiKey) {
    const singleLegacy = process.env.OPENAI_MODEL?.trim();
    const models = parseCommaList(process.env.OPENAI_MODELS, [
      singleLegacy || 'gpt-4o-mini',
    ]);
    const uniq = [...new Set(models)];
    for (const m of uniq) {
      options.push({
        id: `openai:${m}`,
        provider: 'openai',
        model: m,
        label: `OpenAI · ${m}`,
      });
    }
  }

  if (geminiKey) {
    const models = parseCommaList(process.env.GEMINI_MODELS, ['gemini-2.0-flash']);
    const uniq = [...new Set(models)];
    for (const m of uniq) {
      options.push({
        id: `gemini:${m}`,
        provider: 'gemini',
        model: m,
        label: `Gemini · ${m}`,
      });
    }
  }

  const deduped = dedupeById(options);
  return {
    options: deduped,
    defaultChoice: resolveDefaultChoice(deduped),
  };
}

export function resolveModelSelection(
  catalog: AiModelCatalog,
  requested?: string | null
): CatalogOption | null {
  if (catalog.options.length === 0) return null;
  if (requested && catalog.options.some((o) => o.id === requested)) {
    return catalog.options.find((o) => o.id === requested)!;
  }
  const def = catalog.options.find((o) => o.id === catalog.defaultChoice);
  return def ?? catalog.options[0];
}
