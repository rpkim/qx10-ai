import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { GoalType, QueryToolChoice } from '@/lib/types';
import { parseQueryMetadata, normalizeDataNodePayload } from '@/lib/ai/metadata';
import { buildAnswerSystemPrompt, buildMetadataSystemPrompt } from '@/lib/ai/prompts';
import type { CatalogOption } from '@/lib/ai/model-config';
import type { Locale } from '@/lib/i18n/constants';

const encoder = new TextEncoder();

export function sseLine(obj: unknown): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(obj)}\n\n`);
}

function userPayload(
  keyword: string,
  goal: GoalType,
  question: string,
  contextPairs?: Array<{ question: string; answer: string }>,
  rootContext?: string
) {
  const contextText =
    contextPairs && contextPairs.length > 0
      ? [
          'Prior context in this workspace (oldest to latest):',
          ...contextPairs.map(
            (p, i) => `Context Q${i + 1}: ${p.question}\nContext A${i + 1}: ${p.answer}`
          ),
          '',
        ].join('\n')
      : '';
  const contextSuffix = rootContext ? ` (context: "${rootContext}")` : '';
  return `Workspace root keyword/topic: "${keyword}"${contextSuffix}\nExploration goal: ${goal}\n\n${contextText}User query:\n${question}`;
}

/** Re-run keyword / follow-up / optional data-node extraction for an existing Q&A (no full answer regeneration). */
export async function extractAnswerMetadata(
  selection: CatalogOption,
  question: string,
  fullAnswer: string,
  locale: Locale,
  keys: { openaiKey: string | undefined; geminiKey: string | undefined }
): Promise<{
  extractedKeywords: string[];
  suggestedQueries: string[];
  dataNode: ReturnType<typeof normalizeDataNodePayload> | null;
}> {
  let extractedKeywords: string[] = [];
  let suggestedQueries: string[] = [];
  let dataNode: ReturnType<typeof normalizeDataNodePayload> | null = null;

  const metaUser = `QUESTION:\n${question}\n\nANSWER:\n${fullAnswer}`;
  const metadataSystemPrompt = buildMetadataSystemPrompt(locale);

  try {
    if (selection.provider === 'openai' && keys.openaiKey) {
      const openai = new OpenAI({ apiKey: keys.openaiKey });
      const metaRes = await openai.chat.completions.create({
        model: selection.model,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: metadataSystemPrompt },
          { role: 'user', content: metaUser },
        ],
      });
      const raw = metaRes.choices[0]?.message?.content;
      if (raw) {
        const parsed = parseQueryMetadata(JSON.parse(raw));
        if (parsed) {
          extractedKeywords = parsed.extractedKeywords;
          suggestedQueries = parsed.suggestedQueries;
          if (parsed.dataNode) {
            dataNode = normalizeDataNodePayload(parsed.dataNode);
          }
        }
      }
    } else if (selection.provider === 'gemini' && keys.geminiKey) {
      const genAI = new GoogleGenerativeAI(keys.geminiKey);
      const metaModel = genAI.getGenerativeModel({
        model: selection.model,
        generationConfig: { responseMimeType: 'application/json' },
      });
      const r = await metaModel.generateContent(
        `${metadataSystemPrompt}\n\n${metaUser}`
      );
      const raw = r.response.text();
      if (raw) {
        const parsed = parseQueryMetadata(JSON.parse(raw));
        if (parsed) {
          extractedKeywords = parsed.extractedKeywords;
          suggestedQueries = parsed.suggestedQueries;
          if (parsed.dataNode) {
            dataNode = normalizeDataNodePayload(parsed.dataNode);
          }
        }
      }
    }
  } catch {
    // best-effort
  }

  return { extractedKeywords, suggestedQueries, dataNode };
}

export function createWorkspaceQueryReadableStream(
  selection: CatalogOption,
  params: {
    question: string;
    keyword: string;
    goal: GoalType;
    locale: Locale;
    /** Accepted for backward compatibility with older saved workspaces/templates; no longer changes behavior — a `data` node is only ever produced when the model itself proposes one. */
    toolChoice?: QueryToolChoice;
    contextPairs?: Array<{ question: string; answer: string }>;
    context?: string;
  },
  keys: { openaiKey: string | undefined; geminiKey: string | undefined }
): ReadableStream<Uint8Array> {
  const { question, keyword, goal, locale, contextPairs, context } = params;
  const userText = userPayload(keyword, goal, question, contextPairs, context);
  const systemText = buildAnswerSystemPrompt(goal, locale);

  return new ReadableStream({
    async start(controller) {
      let fullAnswer = '';

      try {
        if (selection.provider === 'openai') {
          if (!keys.openaiKey) {
            controller.enqueue(sseLine({ type: 'error', message: 'OpenAI API key missing' }));
            return;
          }
          const openai = new OpenAI({ apiKey: keys.openaiKey });
          const completion = await openai.chat.completions.create({
            model: selection.model,
            stream: true,
            messages: [
              { role: 'system', content: systemText },
              { role: 'user', content: userText },
            ],
          });

          for await (const chunk of completion) {
            const text = chunk.choices[0]?.delta?.content ?? '';
            if (text) {
              fullAnswer += text;
              controller.enqueue(sseLine({ type: 'token', text }));
            }
          }
        } else {
          if (!keys.geminiKey) {
            controller.enqueue(sseLine({ type: 'error', message: 'Gemini API key missing' }));
            return;
          }
          const genAI = new GoogleGenerativeAI(keys.geminiKey);
          const model = genAI.getGenerativeModel({
            model: selection.model,
            systemInstruction: systemText,
          });
          const streamResult = await model.generateContentStream(userText);
          for await (const chunk of streamResult.stream) {
            let text = '';
            try {
              text = chunk.text();
            } catch {
              text = '';
            }
            if (text) {
              fullAnswer += text;
              controller.enqueue(sseLine({ type: 'token', text }));
            }
          }
        }

        if (!fullAnswer.trim()) {
          fullAnswer =
            'I could not generate an answer for this request. Please try rephrasing the question or narrowing the topic.';
        }

        let { extractedKeywords, suggestedQueries, dataNode } = await extractAnswerMetadata(
          selection,
          question,
          fullAnswer,
          locale,
          keys
        );

        if (extractedKeywords.length === 0) {
          extractedKeywords = ['Overview', 'Context', 'Next steps', 'Details'];
        }
        if (suggestedQueries.length < 2) {
          suggestedQueries = [
            locale === 'ko'
              ? `"${keyword}"를 이해할 때 핵심 구성요소는 무엇인가요?`
              : locale === 'ja'
                ? `"${keyword}" を理解するうえで主要な構成要素は何ですか？`
                : locale === 'es'
                  ? `¿Cuáles son los componentes principales de "${keyword}" en este contexto?`
                  : locale === 'zh'
                    ? `在这个语境下，“${keyword}”的核心组成部分是什么？`
                    : `What are the main components of "${keyword}" relevant here?`,
            locale === 'ko'
              ? '다음으로 어떤 관점을 탐색하면 좋을까요?'
              : locale === 'ja'
                ? '次にどの観点を掘り下げるとよいですか？'
                : locale === 'es'
                  ? '¿Qué enfoque debería explorar a continuación?'
                  : locale === 'zh'
                    ? '接下来我应该从哪个角度继续探索？'
                    : 'What should I explore next about this topic?',
            locale === 'ko'
              ? '이 주제에서 자주 생기는 오해나 함정은 무엇인가요?'
              : locale === 'ja'
                ? 'このテーマでよくある誤解や落とし穴は何ですか？'
                : locale === 'es'
                  ? '¿Cuáles son los errores comunes o malentendidos sobre este tema?'
                  : locale === 'zh'
                    ? '这个主题中常见的误区或陷阱有哪些？'
                    : 'What are common pitfalls or misconceptions?',
          ];
        }

        controller.enqueue(
          sseLine({
            type: 'metadata',
            extractedKeywords,
            suggestedQueries,
            dataNode,
          })
        );
        controller.enqueue(sseLine({ type: 'done' }));
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        controller.enqueue(sseLine({ type: 'error', message }));
      } finally {
        controller.close();
      }
    },
  });
}
