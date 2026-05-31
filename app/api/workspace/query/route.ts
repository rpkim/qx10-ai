import type { GoalType, QueryToolChoice } from '@/lib/types';
import { isLocale, type Locale } from '@/lib/i18n/constants';
import {
  buildModelCatalog,
  readGeminiApiKey,
  resolveModelSelection,
} from '@/lib/ai/model-config';
import { createWorkspaceQueryReadableStream } from '@/lib/ai/workspace-query-stream';
import { getAuthSession } from '@/lib/auth/session';
import { ensureUserRecordForSession } from '@/lib/server/ensure-user-record';
import { getAnalyticsStore } from '@/lib/server/analytics/store';
import { nextUtcDayStartMs } from '@/lib/server/quota/config';

export const runtime = 'nodejs';
export const maxDuration = 120;

const BYOK_HEADER = 'x-qx10-gemini-api-key';

function isValidGeminiKey(key: string): boolean {
  return /^AIza[0-9A-Za-z_-]{20,}$/.test(key);
}

export async function POST(req: Request) {
  let body: {
    question?: string;
    keyword?: string;
    goal?: GoalType;
    context?: string | null;
    contextPairs?: Array<{ question?: string; answer?: string }>;
    locale?: string;
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
  const contextPairs = Array.isArray(body.contextPairs)
    ? body.contextPairs
        .map((p) => ({
          question: typeof p?.question === 'string' ? p.question.trim() : '',
          answer: typeof p?.answer === 'string' ? p.answer.trim() : '',
        }))
        .filter((p) => p.question && p.answer)
        .slice(-10)
    : [];
  const locale: Locale = isLocale(body.locale) ? body.locale : 'en';
  const rootContext =
    typeof body.context === 'string' && body.context.trim() ? body.context.trim() : undefined;

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

  const session = await getAuthSession();
  const authDisabled = process.env.AUTH_DISABLED === 'true';
  if (!session && !authDisabled) {
    return new Response(JSON.stringify({ error: 'unauthenticated', code: 'UNAUTHENTICATED' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const userGeminiKey = req.headers.get(BYOK_HEADER)?.trim() ?? '';
  const usingByok = userGeminiKey.length > 0;

  if (usingByok) {
    if (selection.provider !== 'gemini') {
      return new Response(
        JSON.stringify({
          error: 'Personal Gemini API keys only work with Gemini models.',
          code: 'BYOK_GEMINI_ONLY',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (!isValidGeminiKey(userGeminiKey)) {
      return new Response(
        JSON.stringify({ error: 'Invalid Gemini API key format.', code: 'BYOK_INVALID_KEY' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  if (session && !usingByok) {
    await ensureUserRecordForSession(session);
    const consumed = await getAnalyticsStore().tryConsumeDailyQuery({
      sub: session.sub,
      email: session.email,
      keyword,
      goal,
      model: selection.model,
      ts: Date.now(),
    });
    if (!consumed.ok) {
      const status = consumed.code === 'SUSPENDED' ? 403 : 429;
      return new Response(
        JSON.stringify({
          error:
            consumed.code === 'SUSPENDED'
              ? 'Your account is temporarily suspended.'
              : 'Daily AI query limit reached.',
          code: consumed.code,
          quota: consumed.quota,
          dailyLimit: consumed.quota.dailyLimit,
          dailyCount: consumed.quota.dailyCount,
          remaining: consumed.quota.remaining,
          resetsAt: consumed.quota.resetsAt ?? nextUtcDayStartMs(),
          tier: consumed.quota.tier,
          freeTierLimit: consumed.quota.freeTierLimit,
          premiumTierLimit: consumed.quota.premiumTierLimit,
          byokHint: true,
        }),
        { status, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  let openaiKey = process.env.OPENAI_API_KEY?.trim();
  let geminiKey = readGeminiApiKey();

  if (usingByok) {
    geminiKey = userGeminiKey;
  }

  if (selection.provider === 'gemini' && !geminiKey) {
    return new Response(
      JSON.stringify({
        error: 'Gemini API key missing. Add your key in Settings or contact support.',
        code: 'NO_API_KEY',
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
  if (selection.provider === 'openai' && !openaiKey) {
    return new Response(
      JSON.stringify({ error: 'OpenAI API key missing.', code: 'NO_API_KEY' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const stream = createWorkspaceQueryReadableStream(
    selection,
    { question, keyword, goal, locale, toolChoice, contextPairs, context: rootContext },
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
