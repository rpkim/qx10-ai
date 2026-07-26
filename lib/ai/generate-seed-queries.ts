import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import type { GoalType } from '@/lib/types';
import type { CatalogOption } from '@/lib/ai/model-config';
import { GOAL_HINT } from '@/lib/ai/prompts';
import type { Locale } from '@/lib/i18n/constants';
import { parseContextItems } from '@/lib/context-items';
import { fetchPageExcerpts } from '@/lib/ai/url-context';

const seedSchema = z.object({
  questions: z.array(z.string()).min(4).max(8),
});

const MAX_CONTEXT_URLS = 3;

const SEED_SYSTEM = `You help design a knowledge-discovery canvas. Output JSON only, no markdown fences.
Shape: {"questions": string[]}
Rules:
- Exactly 5 strings in "questions".
- Each is one short, specific question the user might run first (full sentence, same language as the topic when possible).
- Cover different angles; no near-duplicates.
- Questions must be concrete enough to answer in one pass.
- If reference material from a URL is provided, you MUST ground at least 2-3 questions in specific facts, claims, or details from that material (not just the topic in general).`;

export async function generateSeedQuestions(
  selection: CatalogOption,
  params: { keyword: string; goal: GoalType; locale: Locale; context?: string },
  keys: { openaiKey: string | undefined; geminiKey: string | undefined }
): Promise<string[]> {
  const { keyword, goal, locale, context } = params;
  const hint = GOAL_HINT[goal] ?? GOAL_HINT.learn;
  const lang =
    locale === 'ko'
      ? 'Korean (ko)'
      : locale === 'ja'
        ? 'Japanese (ja)'
        : locale === 'es'
          ? 'Spanish (es)'
          : locale === 'zh'
            ? 'Simplified Chinese (zh-Hans)'
            : 'English (en)';

  const items = parseContextItems(context);
  const keywordItems = items.filter((i) => !i.isUrl).map((i) => i.value);
  const urlItems = items.filter((i) => i.isUrl).map((i) => i.value).slice(0, MAX_CONTEXT_URLS);
  const excerpts = urlItems.length > 0 ? await fetchPageExcerpts(urlItems) : [];

  const contextLine = keywordItems.length > 0 ? `\nContext: "${keywordItems.join(', ')}"` : '';
  const referenceBlock =
    excerpts.length > 0
      ? `\n\nReference material (user-provided pages — read these and ground questions in them):\n${excerpts
          .map((e, i) => `[${i + 1}] "${e.title}" (${e.url})\n${e.excerpt}`)
          .join('\n\n')}`
      : '';
  const unresolvedUrls = urlItems.filter((u) => !excerpts.some((e) => e.url === u || u.includes(e.url)));
  const unresolvedLine =
    unresolvedUrls.length > 0
      ? `\nNote: the user also referenced ${unresolvedUrls.length} URL(s) that could not be fetched; ignore them.`
      : '';

  const user = `Topic / keyword: "${keyword}"${contextLine}${referenceBlock}${unresolvedLine}
Exploration mode: ${goal}
Mode guidance for biasing the questions: ${hint}
Default output language: ${lang}
If the topic text itself explicitly asks for another language, follow that explicit request.`;

  let raw: string | undefined;

  try {
    if (selection.provider === 'openai' && keys.openaiKey) {
      const openai = new OpenAI({ apiKey: keys.openaiKey });
      const res = await openai.chat.completions.create({
        model: selection.model,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SEED_SYSTEM },
          { role: 'user', content: user },
        ],
      });
      raw = res.choices[0]?.message?.content ?? undefined;
    } else if (selection.provider === 'gemini' && keys.geminiKey) {
      const genAI = new GoogleGenerativeAI(keys.geminiKey);
      const model = genAI.getGenerativeModel({
        model: selection.model,
        generationConfig: { responseMimeType: 'application/json' },
      });
      const r = await model.generateContent(`${SEED_SYSTEM}\n\n${user}`);
      raw = r.response.text();
    }
  } catch {
    return [];
  }

  if (!raw?.trim()) return [];

  try {
    const parsed = seedSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return [];
    return parsed.data.questions
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .slice(0, 5);
  } catch {
    return [];
  }
}
