import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { CatalogOption } from '@/lib/ai/model-config';
import { sseLine } from '@/lib/ai/workspace-query-stream';

export interface ArticleChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ArticleStreamParams {
  systemText: string;
  /** Knowledge base + current draft; re-sent every turn so the model always sees the latest state. */
  contextText: string;
  history: ArticleChatMessage[];
  userText: string;
}

/** Gemini rejects histories that do not start with a user turn. */
function sanitizeHistory(history: ArticleChatMessage[]): ArticleChatMessage[] {
  const firstUser = history.findIndex((m) => m.role === 'user');
  return firstUser < 0 ? [] : history.slice(firstUser);
}

function composeUserTurn(contextText: string, userText: string): string {
  return [contextText, '', '---', '', 'User request:', userText].join('\n');
}

export function createArticleReadableStream(
  selection: CatalogOption,
  params: ArticleStreamParams,
  keys: { openaiKey: string | undefined; geminiKey: string | undefined }
): ReadableStream<Uint8Array> {
  const { systemText, contextText, history, userText } = params;
  const finalUserTurn = composeUserTurn(contextText, userText);

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let streamed = '';
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
              ...history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
              { role: 'user', content: finalUserTurn },
            ],
          });
          for await (const chunk of completion) {
            const text = chunk.choices[0]?.delta?.content ?? '';
            if (text) {
              streamed += text;
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
          const chat = model.startChat({
            history: sanitizeHistory(history).map((m) => ({
              role: m.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: m.content }],
            })),
          });
          const result = await chat.sendMessageStream(finalUserTurn);
          for await (const chunk of result.stream) {
            let text = '';
            try {
              text = chunk.text();
            } catch {
              text = '';
            }
            if (text) {
              streamed += text;
              controller.enqueue(sseLine({ type: 'token', text }));
            }
          }
        }

        if (!streamed.trim()) {
          controller.enqueue(
            sseLine({ type: 'error', message: 'The model returned an empty response.' })
          );
          return;
        }

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
