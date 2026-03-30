import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { GoalType } from '@/lib/types';
import { buildModelCatalog, readGeminiApiKey, resolveModelSelection } from '@/lib/ai/model-config';

export const runtime = 'nodejs';
export const maxDuration = 90;

interface SummaryPair {
  question: string;
  answer: string;
}

function parseGoal(raw: unknown): GoalType {
  if (raw === 'learn' || raw === 'research' || raw === 'build' || raw === 'analyze' || raw === 'strategize') {
    return raw;
  }
  return 'learn';
}

function fallbackSummary(keyword: string, goal: GoalType, pairs: SummaryPair[]): string {
  const latest = pairs.slice(-8);
  return [
    `# Workspace Summary: ${keyword}`,
    '',
    `## Goal`,
    `- ${goal}`,
    '',
    `## Key Questions`,
    ...latest.map((p) => `- ${p.question}`),
    '',
    `## Key Takeaways`,
    ...latest.map((p) => `- ${p.answer.slice(0, 180).trim()}${p.answer.length > 180 ? '...' : ''}`),
    '',
    `## Next Steps`,
    '- Compare conflicting points between answers.',
    '- Convert top 3 takeaways into actionable tasks.',
    '- Add follow-up queries for unresolved gaps.',
  ].join('\n');
}

export async function POST(req: Request) {
  let body: { keyword?: unknown; goal?: unknown; pairs?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const keyword = typeof body.keyword === 'string' ? body.keyword.trim() : '';
  const goal = parseGoal(body.goal);
  const pairs = Array.isArray(body.pairs)
    ? body.pairs
        .map((x) => {
          const obj = x as Record<string, unknown>;
          const question = typeof obj.question === 'string' ? obj.question.trim() : '';
          const answer = typeof obj.answer === 'string' ? obj.answer.trim() : '';
          return question && answer ? { question, answer } : null;
        })
        .filter((x): x is SummaryPair => !!x)
        .slice(0, 40)
    : [];

  if (!keyword || pairs.length === 0) {
    return Response.json({ error: 'keyword and pairs are required' }, { status: 400 });
  }

  const catalog = buildModelCatalog();
  const selection = resolveModelSelection(catalog, null);
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  const geminiKey = readGeminiApiKey();

  if (!selection) {
    return Response.json({ summary: fallbackSummary(keyword, goal, pairs), fallback: true });
  }

  const qaText = pairs
    .map((p, i) => `Q${i + 1}: ${p.question}\nA${i + 1}: ${p.answer}`)
    .join('\n\n');

  const system = [
    'You are an expert knowledge synthesizer.',
    'Return markdown only.',
    'Create a concise one-page summary that is easy for a non-expert to understand.',
    'Use this structure exactly:',
    '# Topic Snapshot',
    '## What We Explored',
    '## Core Insights',
    '## Patterns and Connections',
    '## Open Questions',
    '## Practical Next Actions',
    'When helpful, include short bullet lists and small markdown tables.',
    'For bullet lists, put each item on its own line starting with `-` or `*` followed by a space (never run multiple `* items` on one line).',
  ].join('\n');

  const user = [
    `Topic: ${keyword}`,
    `Goal: ${goal}`,
    '',
    'Questions and answers:',
    qaText,
  ].join('\n');

  try {
    if (selection.provider === 'openai' && openaiKey) {
      const openai = new OpenAI({ apiKey: openaiKey });
      const res = await openai.chat.completions.create({
        model: selection.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      });
      const summary = res.choices[0]?.message?.content?.trim();
      if (summary) return Response.json({ summary, fallback: false });
    }

    if (selection.provider === 'gemini' && geminiKey) {
      const genAI = new GoogleGenerativeAI(geminiKey);
      const model = genAI.getGenerativeModel({
        model: selection.model,
        systemInstruction: system,
      });
      const res = await model.generateContent(user);
      const summary = res.response.text().trim();
      if (summary) return Response.json({ summary, fallback: false });
    }
  } catch {
    // fall through to fallback
  }

  return Response.json({ summary: fallbackSummary(keyword, goal, pairs), fallback: true });
}
