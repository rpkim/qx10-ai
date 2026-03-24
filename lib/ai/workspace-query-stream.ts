import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { GoalType } from '@/lib/types';
import { parseQueryMetadata, normalizeDataNodePayload } from '@/lib/ai/metadata';
import { buildAnswerSystemPrompt, METADATA_SYSTEM_PROMPT } from '@/lib/ai/prompts';
import type { CatalogOption } from '@/lib/ai/model-config';
import { maybeGetMarketDataNodeFromMcp } from '@/lib/ai/mcp-market';

const encoder = new TextEncoder();

export function sseLine(obj: unknown): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(obj)}\n\n`);
}

function userPayload(keyword: string, goal: GoalType, question: string) {
  return `Workspace root keyword/topic: "${keyword}"\nExploration goal: ${goal}\n\nUser query:\n${question}`;
}

async function extractMetadata(
  selection: CatalogOption,
  question: string,
  fullAnswer: string,
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

  try {
    if (selection.provider === 'openai' && keys.openaiKey) {
      const openai = new OpenAI({ apiKey: keys.openaiKey });
      const metaRes = await openai.chat.completions.create({
        model: selection.model,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: METADATA_SYSTEM_PROMPT },
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
        `${METADATA_SYSTEM_PROMPT}\n\n${metaUser}`
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
  params: { question: string; keyword: string; goal: GoalType },
  keys: { openaiKey: string | undefined; geminiKey: string | undefined }
): ReadableStream<Uint8Array> {
  const { question, keyword, goal } = params;
  const userText = userPayload(keyword, goal, question);
  const systemText = buildAnswerSystemPrompt(goal);

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

        const meta = await extractMetadata(selection, question, fullAnswer, keys);
        let { extractedKeywords, suggestedQueries, dataNode } = meta;

        // Optional MCP enrichment: if a ticker-like query is detected and MCP bridge is configured,
        // inject live market data node when the model did not provide one.
        if (!dataNode) {
          const mcp = await maybeGetMarketDataNodeFromMcp(question);
          if (mcp) {
            dataNode = mcp.payload;
            if (!extractedKeywords.includes(mcp.symbol)) {
              extractedKeywords = [mcp.symbol, ...extractedKeywords].slice(0, 14);
            }
          }
        }

        if (extractedKeywords.length === 0) {
          extractedKeywords = ['Overview', 'Context', 'Next steps', 'Details'];
        }
        if (suggestedQueries.length < 2) {
          suggestedQueries = [
            `What are the main components of "${keyword}" relevant here?`,
            `What should I explore next about this topic?`,
            `What are common pitfalls or misconceptions?`,
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
