import { buildModelCatalog } from '@/lib/ai/model-config';

export const runtime = 'nodejs';

/**
 * Public catalog for the UI (no API keys). Options come from env:
 * OPENAI_MODELS, GEMINI_MODELS, AI_DEFAULT, AI_MODEL_OPTIONS, and configured keys.
 */
export async function GET() {
  const catalog = buildModelCatalog();
  return Response.json({
    defaultChoice: catalog.defaultChoice,
    options: catalog.options,
  });
}
