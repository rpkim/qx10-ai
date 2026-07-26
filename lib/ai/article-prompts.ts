import type { GoalType } from '@/lib/types';
import type { Locale } from '@/lib/i18n/constants';
import type { MessageKey } from '@/lib/i18n/messages/types';
import { GOAL_HINT, localeKey, preferredLanguageLabel } from '@/lib/ai/prompts';

/** Fence tag that wraps markdown the user can apply to the article body. */
export const ARTICLE_PROPOSAL_FENCE = 'qx10-proposal';

/** Separator between the seed header (TITLE/SUBTITLE) and the article body. */
export const ARTICLE_SEED_SEPARATOR = '---';

export interface ArticleDraft {
  title: string;
  subtitle: string;
  body: string;
}

export interface ArticleQaPair {
  question: string;
  answer: string;
}

export type ArticleQuickActionId =
  | 'outline'
  | 'intro'
  | 'conclusion'
  | 'titles'
  | 'reconcile'
  | 'headings'
  | 'tone'
  | 'simplify';

export interface ArticleQuickAction {
  id: ArticleQuickActionId;
  labelKey: MessageKey;
  /** Sent as the user turn when the chip is clicked. */
  prompt: string;
}

export const ARTICLE_QUICK_ACTIONS: ArticleQuickAction[] = [
  {
    id: 'outline',
    labelKey: 'article.quick.outline',
    prompt:
      'Propose an outline for this article: a heading structure that organizes everything I explored into a readable narrative. Explain the reasoning briefly, then give the outline as a proposal I can insert.',
  },
  {
    id: 'intro',
    labelKey: 'article.quick.intro',
    prompt:
      'Write or improve the introduction so a reader immediately understands what the article covers and why it matters. Keep it under 120 words.',
  },
  {
    id: 'conclusion',
    labelKey: 'article.quick.conclusion',
    prompt:
      'Write a closing section that summarizes the key takeaways and names the open questions that remain unanswered.',
  },
  {
    id: 'titles',
    labelKey: 'article.quick.titles',
    prompt:
      'Suggest 5 title and subtitle pairs for this article, ranging from descriptive to catchy. List them as plain text (no proposal block) so I can pick one.',
  },
  {
    id: 'reconcile',
    labelKey: 'article.quick.reconcile',
    prompt:
      'Review the draft against the workspace knowledge: point out duplicated passages, contradictions, and claims that the explored answers do not support. List the issues first, then propose a corrected version of the affected sections.',
  },
  {
    id: 'headings',
    labelKey: 'article.quick.headings',
    prompt:
      'Restructure the headings so the article scans well: descriptive H2/H3 levels, consistent phrasing, and no orphan sections. Propose the rewritten heading structure with the existing content moved under it.',
  },
  {
    id: 'tone',
    labelKey: 'article.quick.tone',
    prompt:
      'Unify the tone of the whole draft so it reads like one author wrote it, matching the exploration goal of this workspace.',
  },
  {
    id: 'simplify',
    labelKey: 'article.quick.simplify',
    prompt:
      'Rewrite the dense parts in plainer language: shorter sentences, concrete examples, and jargon explained on first use. Keep every technical fact intact.',
  },
];

export function getArticleQuickAction(id: string): ArticleQuickAction | null {
  return ARTICLE_QUICK_ACTIONS.find((a) => a.id === id) ?? null;
}

function languageLines(locale: Locale): string[] {
  const label = preferredLanguageLabel(locale);
  return [
    `Default output language: ${label} (${localeKey(locale)}).`,
    'If the user explicitly asks for another language, follow that request instead.',
  ];
}

export function buildArticleSeedSystemPrompt(goal: GoalType, locale: Locale): string {
  return [
    'You are the writing partner inside qx10.lol Article Studio.',
    'The user explored a topic as a tree of questions and answers, and now wants that exploration turned into one publishable article.',
    GOAL_HINT[goal] ?? GOAL_HINT.learn,
    ...languageLines(locale),
    '',
    'Return exactly this format and nothing else:',
    'TITLE: <one-line article title>',
    'SUBTITLE: <one-line subtitle that adds context, not a repeat of the title>',
    ARTICLE_SEED_SEPARATOR,
    '<article body in markdown>',
    '',
    'Body rules:',
    '- Do not repeat the title as a heading; the body starts with the opening paragraph.',
    '- Organize by theme, not by the order the questions were asked. Use `##` sections (and `###` where a section needs sub-parts).',
    '- Ground every claim in the provided questions and answers. Do not invent facts, numbers, or sources.',
    '- Mix short paragraphs with bullet lists and small markdown tables where they genuinely help.',
    '- Each bullet goes on its own line starting with `- `.',
    '- End with a section of key takeaways and a section of open questions that the exploration did not settle.',
    '- Aim for a draft the user will edit, not a finished essay: complete sentences, no placeholders like TODO.',
  ].join('\n');
}

export function buildArticleChatSystemPrompt(goal: GoalType, locale: Locale): string {
  return [
    'You are the writing partner inside qx10.lol Article Studio.',
    'The screen is split: the user edits a markdown article on the left, and talks to you on the right.',
    'You never edit the article yourself. You propose content, and the user clicks Insert to apply it.',
    GOAL_HINT[goal] ?? GOAL_HINT.learn,
    ...languageLines(locale),
    '',
    'Answering rules:',
    '- Ground your writing in the workspace knowledge provided below. If something is missing from it, say so instead of inventing it.',
    '- Keep conversational replies short: a sentence or two of reasoning is enough.',
    '',
    'Proposal rules:',
    `- When you write markdown meant for the article body, put it inside a fenced block tagged \`${ARTICLE_PROPOSAL_FENCE}\`:`,
    '',
    `\`\`\`${ARTICLE_PROPOSAL_FENCE}`,
    '## Section heading',
    '',
    'Body text the user can insert as-is.',
    '```',
    '',
    '- Everything outside the fence is plain conversation and will not be inserted.',
    '- Put only article content inside the fence: no commentary, no explanation, no nested code fences unless the article itself needs a code block.',
    '- One proposal block per reply unless the user explicitly asks for alternatives.',
    '- If the user asks a question, is picking between options, or wants a critique, reply in plain prose with no proposal block.',
    '- Never say the article was updated. Say what the proposal does and let the user apply it.',
  ].join('\n');
}

export function buildKnowledgeContext(params: {
  keyword: string;
  goal: GoalType;
  context?: string;
  pairs: ArticleQaPair[];
  widgets?: string[];
}): string {
  const { keyword, goal, context, pairs, widgets } = params;
  const lines = [
    `Workspace topic: ${keyword}${context ? ` (context: "${context}")` : ''}`,
    `Exploration goal: ${goal}`,
  ];

  if (pairs.length > 0) {
    lines.push('', 'Explored questions and answers:');
    pairs.forEach((p, i) => {
      lines.push(`Q${i + 1}: ${p.question}`, `A${i + 1}: ${p.answer}`, '');
    });
  }

  if (widgets && widgets.length > 0) {
    lines.push('Pinned dashboard widgets:', ...widgets, '');
  }

  return lines.join('\n').trim();
}

export function buildDraftContext(draft: ArticleDraft, selection?: string): string {
  const body = draft.body.trim();
  const lines = [
    'Current article draft:',
    `TITLE: ${draft.title.trim() || '(empty)'}`,
    `SUBTITLE: ${draft.subtitle.trim() || '(empty)'}`,
    ARTICLE_SEED_SEPARATOR,
    body || '(the body is still empty)',
  ];

  if (selection?.trim()) {
    lines.push(
      '',
      'The user has selected this passage in the editor — treat it as the focus of the request:',
      selection.trim()
    );
  }

  return lines.join('\n');
}

/** Used when no AI provider is configured, so the studio still opens with something editable. */
export function fallbackSeedArticle(
  keyword: string,
  goal: GoalType,
  pairs: ArticleQaPair[]
): string {
  const latest = pairs.slice(-8);
  return [
    `TITLE: ${keyword}`,
    `SUBTITLE: Notes from a ${goal} exploration`,
    ARTICLE_SEED_SEPARATOR,
    `This draft collects what the workspace on **${keyword}** explored so far. Edit it freely — the sections below are only a starting point.`,
    '',
    '## What we explored',
    ...latest.map((p) => `- ${p.question}`),
    '',
    '## Notes',
    ...latest.flatMap((p) => [`### ${p.question}`, '', p.answer.trim(), '']),
    '## Open questions',
    '- Which claims still need a source?',
    '- What did the exploration leave unanswered?',
  ].join('\n');
}
