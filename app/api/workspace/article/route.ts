import type { GoalType } from '@/lib/types';
import { isLocale, type Locale } from '@/lib/i18n/constants';
import {
  buildModelCatalog,
  readGeminiApiKey,
  resolveModelSelection,
} from '@/lib/ai/model-config';
import {
  buildArticleChatSystemPrompt,
  buildArticleSeedSystemPrompt,
  buildDraftContext,
  buildKnowledgeContext,
  fallbackSeedArticle,
  getArticleQuickAction,
  type ArticleDraft,
  type ArticleQaPair,
} from '@/lib/ai/article-prompts';
import { createArticleReadableStream, type ArticleChatMessage } from '@/lib/ai/article-stream';
import { sseLine } from '@/lib/ai/workspace-query-stream';

export const runtime = 'nodejs';
export const maxDuration = 120;

const BYOK_HEADER = 'x-qx10-gemini-api-key';
const MAX_PAIRS = 40;
const MAX_HISTORY = 20;
const MAX_MESSAGE_CHARS = 8_000;
const MAX_BODY_CHARS = 60_000;

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
};

function isValidGeminiKey(key: string): boolean {
  return /^AIza[0-9A-Za-z_-]{20,}$/.test(key);
}

function parseGoal(raw: unknown): GoalType {
  return raw === 'learn' ||
    raw === 'research' ||
    raw === 'build' ||
    raw === 'analyze' ||
    raw === 'strategize'
    ? raw
    : 'learn';
}

function parsePairs(raw: unknown): ArticleQaPair[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => {
      const obj = x as Record<string, unknown>;
      const question = typeof obj?.question === 'string' ? obj.question.trim() : '';
      const answer = typeof obj?.answer === 'string' ? obj.answer.trim() : '';
      return question && answer ? { question, answer } : null;
    })
    .filter((x): x is ArticleQaPair => !!x)
    .slice(-MAX_PAIRS);
}

function parseWidgets(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => (typeof x === 'string' ? x.trim() : ''))
    .filter(Boolean)
    .slice(0, 20);
}

function parseDraft(raw: unknown): ArticleDraft {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  return {
    title: str(obj.title).slice(0, 300),
    subtitle: str(obj.subtitle).slice(0, 500),
    body: str(obj.body).slice(0, MAX_BODY_CHARS),
  };
}

function parseHistory(raw: unknown): ArticleChatMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => {
      const obj = x as Record<string, unknown>;
      const role = obj?.role === 'assistant' ? 'assistant' : obj?.role === 'user' ? 'user' : null;
      const content = typeof obj?.content === 'string' ? obj.content.trim() : '';
      return role && content ? { role, content: content.slice(0, MAX_BODY_CHARS) } : null;
    })
    .filter((x): x is ArticleChatMessage => !!x)
    .slice(-MAX_HISTORY);
}

function streamOfText(text: string): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(sseLine({ type: 'token', text }));
      controller.enqueue(sseLine({ type: 'done' }));
      controller.close();
    },
  });
}

function jsonError(error: string, code: string, status: number): Response {
  return Response.json({ error, code }, { status });
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonError('Invalid JSON body', 'INVALID_JSON', 400);
  }

  const mode = body.mode === 'seed' ? 'seed' : 'chat';
  const keyword = typeof body.keyword === 'string' ? body.keyword.trim() : '';
  if (!keyword) {
    return jsonError('keyword is required', 'INVALID_REQUEST', 400);
  }

  const goal = parseGoal(body.goal);
  const rawLocale = typeof body.locale === 'string' ? body.locale : '';
  const locale: Locale = isLocale(rawLocale) ? rawLocale : 'en';
  const context =
    typeof body.context === 'string' && body.context.trim() ? body.context.trim() : undefined;
  const pairs = parsePairs(body.pairs);
  const widgets = parseWidgets(body.widgets);
  const draft = parseDraft(body.draft);
  const selection = typeof body.selection === 'string' ? body.selection.slice(0, 8_000) : '';

  let userText = '';
  if (mode === 'seed') {
    if (pairs.length === 0) {
      return jsonError('pairs are required to draft an article', 'INVALID_REQUEST', 400);
    }
    userText =
      'Draft the first version of this article from the exploration above, following the required format.';
  } else {
    const quickAction =
      typeof body.action === 'string' ? getArticleQuickAction(body.action) : null;
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    userText = quickAction ? quickAction.prompt : message;
    if (!userText) {
      return jsonError('message or action is required', 'INVALID_REQUEST', 400);
    }
    userText = userText.slice(0, MAX_MESSAGE_CHARS);
  }

  const catalog = buildModelCatalog();
  const modelSelection = resolveModelSelection(
    catalog,
    typeof body.modelChoice === 'string' && body.modelChoice.trim() ? body.modelChoice.trim() : null
  );

  const userGeminiKey = req.headers.get(BYOK_HEADER)?.trim() ?? '';
  const usingByok = userGeminiKey.length > 0 && isValidGeminiKey(userGeminiKey);
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  const geminiKey = usingByok ? userGeminiKey : readGeminiApiKey();

  const providerReady =
    !!modelSelection &&
    ((modelSelection.provider === 'openai' && !!openaiKey) ||
      (modelSelection.provider === 'gemini' && !!geminiKey));

  if (!providerReady) {
    // The studio should still open with an editable draft when no provider is configured.
    if (mode === 'seed') {
      return new Response(streamOfText(fallbackSeedArticle(keyword, goal, pairs)), {
        headers: SSE_HEADERS,
      });
    }
    return jsonError(
      'No AI provider configured. Set OPENAI_API_KEY and/or GEMINI_API_KEY.',
      'NO_AI_CONFIGURED',
      503
    );
  }

  const knowledgeContext = buildKnowledgeContext({ keyword, goal, context, pairs, widgets });
  const contextText =
    mode === 'seed'
      ? knowledgeContext
      : [knowledgeContext, '', buildDraftContext(draft, selection)].join('\n');

  const stream = createArticleReadableStream(
    modelSelection,
    {
      systemText:
        mode === 'seed'
          ? buildArticleSeedSystemPrompt(goal, locale)
          : buildArticleChatSystemPrompt(goal, locale),
      contextText,
      history: mode === 'seed' ? [] : parseHistory(body.messages),
      userText,
    },
    { openaiKey, geminiKey }
  );

  return new Response(stream, { headers: SSE_HEADERS });
}
