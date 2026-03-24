import type { GoalType, QueryToolChoice } from '@/lib/types';
import {
  buildModelCatalog,
  readGeminiApiKey,
  resolveModelSelection,
} from '@/lib/ai/model-config';
import { createWorkspaceQueryReadableStream } from '@/lib/ai/workspace-query-stream';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(req: Request) {
  let body: {
    question?: string;
    keyword?: string;
    goal?: GoalType;
    /** Catalog id e.g. `openai:gpt-4o-mini` */
    modelChoice?: string | null;
    toolChoice?: QueryToolChoice | null;
  };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const question = typeof body.question === 'string' ? body.question.trim() : '';
  if (!question) {
    return new Response(JSON.stringify({ error: 'question is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (question.length > 16_000) {
    return new Response(JSON.stringify({ error: 'question is too long' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const keyword =
    typeof body.keyword === 'string' && body.keyword.trim() ? body.keyword.trim() : 'General topic';
  const goal: GoalType =
    body.goal === 'learn' ||
    body.goal === 'research' ||
    body.goal === 'build' ||
    body.goal === 'analyze' ||
    body.goal === 'strategize'
      ? body.goal
      : 'learn';

  const catalog = buildModelCatalog();
  if (catalog.options.length === 0) {
    return new Response(
      JSON.stringify({
        error: 'No AI provider configured. Set OPENAI_API_KEY and/or GEMINI_API_KEY.',
        code: 'NO_AI_CONFIGURED',
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const modelChoice =
    typeof body.modelChoice === 'string' && body.modelChoice.trim()
      ? body.modelChoice.trim()
      : null;
  const toolChoice: QueryToolChoice =
    body.toolChoice === 'market' || body.toolChoice === 'web' || body.toolChoice === 'auto'
      ? body.toolChoice
      : 'auto';
  const selection = resolveModelSelection(catalog, modelChoice);
  if (!selection) {
    return new Response(JSON.stringify({ error: 'Invalid model selection' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  const geminiKey = readGeminiApiKey();

  const stream = createWorkspaceQueryReadableStream(
    selection,
    { question, keyword, goal, toolChoice },
    { openaiKey, geminiKey }
  );

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
