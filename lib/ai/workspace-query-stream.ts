import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { GoalType, QueryToolChoice } from '@/lib/types';
import { parseQueryMetadata, normalizeDataNodePayload } from '@/lib/ai/metadata';
import { buildAnswerSystemPrompt, buildMetadataSystemPrompt } from '@/lib/ai/prompts';
import type { CatalogOption } from '@/lib/ai/model-config';
import { maybeGetMarketDataNodeFromApi } from '@/lib/ai/market-api';
import { maybeGetWebSearchDataNode } from '@/lib/ai/web-search-api';
import type { Locale } from '@/lib/i18n/constants';

const encoder = new TextEncoder();

export function sseLine(obj: unknown): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(obj)}\n\n`);
}

function userPayload(
  keyword: string,
  goal: GoalType,
  question: string,
  contextPairs?: Array<{ question: string; answer: string }>
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
  return `Workspace root keyword/topic: "${keyword}"\nExploration goal: ${goal}\n\n${contextText}User query:\n${question}`;
}

async function extractMetadata(
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
    toolChoice?: QueryToolChoice;
    contextPairs?: Array<{ question: string; answer: string }>;
  },
  keys: { openaiKey: string | undefined; geminiKey: string | undefined }
): ReadableStream<Uint8Array> {
  const { question, keyword, goal, locale, toolChoice, contextPairs } = params;
  const userText = userPayload(keyword, goal, question, contextPairs);
  const systemText = buildAnswerSystemPrompt(goal, locale);

  return new ReadableStream({
    async start(controller) {
      let fullAnswer = '';
      const selectedTool: QueryToolChoice = toolChoice ?? 'auto';

      try {
        if (selectedTool === 'market') {
          const market = await maybeGetMarketDataNodeFromApi(question);
          const answer =
            market?.summary ??
            (locale === 'ko'
              ? '시장 데이터를 가져오지 못했습니다. 티커(예: NKE, AAPL) 또는 회사명을 조금 더 명확히 입력해 주세요.'
              : locale === 'ja'
                ? '市場データを取得できませんでした。ティッカー（例: NKE, AAPL）または会社名をもう少し具体的に入力してください。'
                : locale === 'es'
                  ? 'No se pudieron obtener datos del mercado. Ingresa el ticker (p. ej., NKE, AAPL) o el nombre de la empresa con más precisión.'
                  : locale === 'zh'
                    ? '无法获取市场数据。请更明确地输入股票代码（例如 NKE、AAPL）或公司名称。'
                    : 'Could not fetch market data. Please enter a clearer ticker (e.g., NKE, AAPL) or company name.');
          controller.enqueue(sseLine({ type: 'token', text: answer }));
          controller.enqueue(
            sseLine({
              type: 'metadata',
              extractedKeywords: market ? [market.symbol, '실시간 데이터', '주가'] : ['시장 데이터'],
              suggestedQueries: market
                ? [
                    locale === 'ko'
                      ? `${market.symbol} 장중 흐름을 더 자세히 분석해줘`
                      : locale === 'ja'
                        ? `${market.symbol} の当日値動きを詳しく分析して`
                        : locale === 'es'
                          ? `Analiza con más detalle el movimiento intradía de ${market.symbol}`
                          : locale === 'zh'
                            ? `请更详细分析 ${market.symbol} 的盘中走势`
                            : `Analyze ${market.symbol}'s intraday movement in more detail`,
                    locale === 'ko'
                      ? `${market.symbol}와 같은 섹터 종목 비교해줘`
                      : locale === 'ja'
                        ? `${market.symbol} と同セクター銘柄を比較して`
                        : locale === 'es'
                          ? `Compara ${market.symbol} con acciones del mismo sector`
                          : locale === 'zh'
                            ? `请将 ${market.symbol} 与同板块股票进行比较`
                            : `Compare ${market.symbol} with stocks in the same sector`,
                    locale === 'ko'
                      ? `${market.symbol} 투자 시 체크할 리스크는?`
                      : locale === 'ja'
                        ? `${market.symbol} への投資で確認すべきリスクは？`
                        : locale === 'es'
                          ? `¿Qué riesgos debo revisar al invertir en ${market.symbol}?`
                          : locale === 'zh'
                            ? `投资 ${market.symbol} 时应重点关注哪些风险？`
                            : `What risks should I check before investing in ${market.symbol}?`,
                  ]
                : [
                    locale === 'ko'
                      ? '티커를 직접 입력해서 다시 시도해볼래?'
                      : locale === 'ja'
                        ? 'ティッカーを直接入力してもう一度試しますか？'
                        : locale === 'es'
                          ? '¿Quieres intentarlo de nuevo ingresando el ticker directamente?'
                          : locale === 'zh'
                            ? '要不要直接输入股票代码再试一次？'
                            : 'Would you like to try again by entering a ticker directly?',
                    locale === 'ko'
                      ? '다른 종목으로 시도해볼래?'
                      : locale === 'ja'
                        ? '別の銘柄で試してみますか？'
                        : locale === 'es'
                          ? '¿Quieres probar con otra acción?'
                          : locale === 'zh'
                            ? '要不要换一只股票试试？'
                            : 'Would you like to try a different stock?',
                    locale === 'ko'
                      ? '웹 검색 모드로 전환해서 확인해볼래?'
                      : locale === 'ja'
                        ? 'Web検索モードに切り替えて確認しますか？'
                        : locale === 'es'
                          ? '¿Quieres cambiar al modo de búsqueda web para verificarlo?'
                          : locale === 'zh'
                            ? '要不要切换到网页搜索模式来确认？'
                            : 'Would you like to switch to web search mode to verify this?',
                  ],
              dataNode: market?.payload ?? null,
            })
          );
          controller.enqueue(sseLine({ type: 'done' }));
          return;
        }

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

        const meta = await extractMetadata(selection, question, fullAnswer, locale, keys);
        let { extractedKeywords, suggestedQueries, dataNode } = meta;

        // Tool enrichment path:
        // - explicit tool selection should override model-generated dataNode
        // - auto mode only supplements when model omitted dataNode
        if (selectedTool === 'web') {
          const web = await maybeGetWebSearchDataNode(question);
          if (web) {
            dataNode = web.payload;
            extractedKeywords = [...web.keywords, ...extractedKeywords].slice(0, 14);
          }
        } else if (!dataNode) {
          const market = await maybeGetMarketDataNodeFromApi(question);
          if (market) {
            dataNode = market.payload;
            if (!extractedKeywords.includes(market.symbol)) {
              extractedKeywords = [market.symbol, ...extractedKeywords].slice(0, 14);
            }
          } else {
            const web = await maybeGetWebSearchDataNode(question);
            if (web) {
              dataNode = web.payload;
              extractedKeywords = [...web.keywords, ...extractedKeywords].slice(0, 14);
            }
          }
        }

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
