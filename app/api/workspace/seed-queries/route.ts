import type { GoalType } from '@/lib/types';
import {
  buildModelCatalog,
  readGeminiApiKey,
  resolveModelSelection,
} from '@/lib/ai/model-config';
import { generateSeedQuestions } from '@/lib/ai/generate-seed-queries';
import { getSuggestedQueries } from '@/lib/mock-data';
import { isLocale, type Locale } from '@/lib/i18n/constants';

export const runtime = 'nodejs';
export const maxDuration = 60;

function fallbackSeedQueries(keyword: string, locale: Locale): string[] {
  if (locale === 'ko') {
    return [
      `"${keyword}"는 무엇인가요?`,
      `"${keyword}"의 핵심 구성요소는 무엇인가요?`,
      `"${keyword}"를 처음 시작하려면 무엇부터 해야 하나요?`,
      `"${keyword}"에서 자주 하는 실수는 무엇인가요?`,
      `"${keyword}" 관련해 다음으로 탐색하면 좋은 주제는 무엇인가요?`,
    ];
  }
  if (locale === 'ja') {
    return [
      `"${keyword}" とは何ですか？`,
      `"${keyword}" の主要な構成要素は何ですか？`,
      `"${keyword}" を始めるには何から着手すべきですか？`,
      `"${keyword}" でよくある失敗は何ですか？`,
      `"${keyword}" の次に掘り下げるべき論点は何ですか？`,
    ];
  }
  if (locale === 'es') {
    return [
      `¿Qué es "${keyword}"?`,
      `¿Cuáles son los componentes principales de "${keyword}"?`,
      `¿Por dónde debería empezar con "${keyword}"?`,
      `¿Cuáles son los errores más comunes en "${keyword}"?`,
      `¿Qué debería explorar después sobre "${keyword}"?`,
    ];
  }
  if (locale === 'zh') {
    return [
      `“${keyword}”是什么？`,
      `“${keyword}”的核心组成部分有哪些？`,
      `如果我要开始学习“${keyword}”，第一步该做什么？`,
      `“${keyword}”中最常见的误区有哪些？`,
      `关于“${keyword}”，接下来最值得继续探索的方向是什么？`,
    ];
  }
  return getSuggestedQueries(keyword).slice(0, 5);
}

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
  let body: { keyword?: string; goal?: unknown; locale?: string; context?: string };
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
  const locale: Locale = isLocale(body.locale) ? body.locale : 'en';
  const rootContext =
    typeof body.context === 'string' && body.context.trim() ? body.context.trim() : undefined;

  const fallback = () => fallbackSeedQueries(keyword, locale);

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
    { keyword, goal, locale, context: rootContext },
    { openaiKey, geminiKey }
  );

  const questions =
    generated.length >= 4 ? generated.slice(0, 5) : fallback();

  return Response.json({ questions });
}
