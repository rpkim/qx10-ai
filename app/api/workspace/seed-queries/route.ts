import type { GoalType } from '@/lib/types';
import {
  buildModelCatalog,
  readGeminiApiKey,
  resolveModelSelection,
} from '@/lib/ai/model-config';
import { generateSeedQuestions } from '@/lib/ai/generate-seed-queries';
import { getSuggestedQueries } from '@/lib/mock-data';

export const runtime = 'nodejs';
export const maxDuration = 60;

function parseGoal(raw: unknown): GoalType {
  if (
    raw === 'learn' ||
    raw === 'research' ||
    raw === 'build' ||
    raw === 'analyze' ||
    raw === 'strategize'
  ) {
    return raw;
  }
  return 'learn';
}

/**
 * AI-generated opening questions for the root keyword + exploration mode.
 * Falls back to static templates when no API keys or generation fails.
 */
export async function POST(req: Request) {
  let body: { keyword?: string; goal?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const keyword =
    typeof body.keyword === 'string' && body.keyword.trim()
      ? body.keyword.trim()
      : '';
  if (!keyword) {
    return new Response(JSON.stringify({ error: 'keyword is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const goal = parseGoal(body.goal);

  const fallback = () => getSuggestedQueries(keyword).slice(0, 5);

  const catalog = buildModelCatalog();
  if (catalog.options.length === 0) {
    return Response.json({ questions: fallback() });
  }

  const selection = resolveModelSelection(catalog, null);
  if (!selection) {
    return Response.json({ questions: fallback() });
  }

  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  const geminiKey = readGeminiApiKey();

  const generated = await generateSeedQuestions(
    selection,
    { keyword, goal },
    { openaiKey, geminiKey }
  );

  const questions =
    generated.length >= 4 ? generated.slice(0, 5) : fallback();

  return Response.json({ questions });
}
