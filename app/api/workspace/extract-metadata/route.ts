import { isLocale, type Locale } from '@/lib/i18n/constants';
import {
  buildModelCatalog,
  readGeminiApiKey,
  resolveModelSelection,
} from '@/lib/ai/model-config';
import { extractAnswerMetadata } from '@/lib/ai/workspace-query-stream';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  let body: {
    question?: string;
    answer?: string;
    locale?: string;
    modelChoice?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const question = typeof body.question === 'string' ? body.question.trim() : '';
  const answer = typeof body.answer === 'string' ? body.answer.trim() : '';
  if (!question || !answer) {
    return Response.json({ error: 'question and answer are required' }, { status: 400 });
  }
  if (answer.length > 120_000) {
    return Response.json({ error: 'answer is too long' }, { status: 400 });
  }

  const locale: Locale = isLocale(body.locale) ? body.locale : 'en';

  const catalog = buildModelCatalog();
  if (catalog.options.length === 0) {
    return Response.json(
      {
        error: 'No AI provider configured. Set OPENAI_API_KEY and/or GEMINI_API_KEY.',
        code: 'NO_AI_CONFIGURED',
      },
      { status: 503 }
    );
  }

  const modelChoice =
    typeof body.modelChoice === 'string' && body.modelChoice.trim()
      ? body.modelChoice.trim()
      : null;
  const selection = resolveModelSelection(catalog, modelChoice);
  if (!selection) {
    return Response.json({ error: 'Invalid model selection' }, { status: 400 });
  }

  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  const geminiKey = readGeminiApiKey();

  try {
    const meta = await extractAnswerMetadata(
      selection,
      question,
      answer,
      locale,
      { openaiKey, geminiKey }
    );
    return Response.json({
      extractedKeywords: meta.extractedKeywords,
      suggestedQueries: meta.suggestedQueries,
      dataNode: meta.dataNode,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Metadata extraction failed';
    return Response.json({ error: message }, { status: 500 });
  }
}
