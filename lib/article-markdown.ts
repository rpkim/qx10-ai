import type { DataNodeData, WorkspaceNode } from '@/lib/types';
import {
  ARTICLE_PROPOSAL_FENCE,
  ARTICLE_SEED_SEPARATOR,
  type ArticleDraft,
} from '@/lib/ai/article-prompts';

export interface ArticleQaSource {
  answerId: string;
  question: string;
  answer: string;
}

export interface ArticleOutlineItem {
  id: string;
  level: 2 | 3;
  title: string;
  /** Markdown after this heading and before its first child heading. */
  content: string;
  children: ArticleOutlineItem[];
}

export interface ArticleOutline {
  /** Markdown before the first H2 heading, usually the introduction. */
  preamble: string;
  items: ArticleOutlineItem[];
}

function outlineId(index: number, childIndex?: number): string {
  return childIndex == null ? `section-${index}` : `section-${index}-${childIndex}`;
}

/**
 * Parses H2/H3 headings into a movable outline. Headings inside fenced code
 * blocks are ignored, and H4+ remain part of their parent section content.
 */
export function parseArticleOutline(markdown: string): ArticleOutline {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const items: ArticleOutlineItem[] = [];
  const preamble: string[] = [];
  let section: ArticleOutlineItem | null = null;
  let child: ArticleOutlineItem | null = null;
  let inFence = false;

  const append = (line: string) => {
    if (child) child.content += `${child.content ? '\n' : ''}${line}`;
    else if (section) section.content += `${section.content ? '\n' : ''}${line}`;
    else preamble.push(line);
  };

  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      append(line);
      continue;
    }
    if (!inFence) {
      const h2 = /^##\s+(.+?)\s*$/.exec(line);
      if (h2) {
        section = {
          id: outlineId(items.length),
          level: 2,
          title: h2[1],
          content: '',
          children: [],
        };
        items.push(section);
        child = null;
        continue;
      }
      const h3 = /^###\s+(.+?)\s*$/.exec(line);
      if (h3 && section) {
        child = {
          id: outlineId(items.length - 1, section.children.length),
          level: 3,
          title: h3[1],
          content: '',
          children: [],
        };
        section.children.push(child);
        continue;
      }
    }
    append(line);
  }

  const trim = (value: string) => value.replace(/^\n+|\n+$/g, '');
  return {
    preamble: trim(preamble.join('\n')),
    items: items.map((item) => ({
      ...item,
      content: trim(item.content),
      children: item.children.map((nested) => ({ ...nested, content: trim(nested.content) })),
    })),
  };
}

/** Rebuilds markdown after outline titles/order have been edited. */
export function serializeArticleOutline(outline: ArticleOutline): string {
  const blocks: string[] = [];
  if (outline.preamble.trim()) blocks.push(outline.preamble.trim());
  for (const item of outline.items) {
    const sectionBlocks = [`## ${item.title.trim() || 'Untitled section'}`];
    if (item.content.trim()) sectionBlocks.push(item.content.trim());
    for (const child of item.children) {
      sectionBlocks.push(`### ${child.title.trim() || 'Untitled section'}`);
      if (child.content.trim()) sectionBlocks.push(child.content.trim());
    }
    blocks.push(sectionBlocks.join('\n\n'));
  }
  return blocks.join('\n\n').trim();
}

/** Completed Q&A pairs on the canvas, oldest first. */
export function collectQaSources(nodes: WorkspaceNode[]): ArticleQaSource[] {
  const questionById = new Map(
    nodes.filter((n) => n.type === 'query').map((n) => [n.id, n.question] as const)
  );
  return nodes
    .filter((n): n is Extract<WorkspaceNode, { type: 'answer' }> => n.type === 'answer')
    .map((a) => {
      const question = questionById.get(a.queryId);
      const answer = a.content.trim();
      return question && answer ? { answerId: a.id, question, answer } : null;
    })
    .filter((x): x is ArticleQaSource => !!x);
}

function markdownTable(columns: string[], rows: (string | number)[][]): string {
  if (columns.length === 0) return '';
  const escape = (v: string | number) => String(v ?? '').replace(/\|/g, '\\|').trim();
  return [
    `| ${columns.map(escape).join(' | ')} |`,
    `| ${columns.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${columns.map((_, i) => escape(row[i] ?? '')).join(' | ')} |`),
  ].join('\n');
}

export function dataNodeToMarkdown(node: DataNodeData): string {
  const blocks: string[] = [`### ${node.title.trim() || 'Data'}`];
  if (node.subtitle?.trim()) blocks.push(`_${node.subtitle.trim()}_`);

  switch (node.dataType) {
    case 'table': {
      const columns = node.tableColumns ?? [];
      const rows = (node.tableRows ?? []).map((row) => columns.map((c) => row[c] ?? ''));
      const table = markdownTable(columns, rows);
      if (table) blocks.push(table);
      break;
    }
    case 'bar-chart':
    case 'line-chart': {
      const points = node.chartData ?? [];
      const hasSecond = points.some((p) => typeof p.value2 === 'number');
      const columns = hasSecond ? ['Label', 'Value', 'Value 2'] : ['Label', 'Value'];
      const rows = points.map((p) =>
        hasSecond ? [p.label, p.value, p.value2 ?? ''] : [p.label, p.value]
      );
      const table = markdownTable(columns, rows);
      if (table) blocks.push(table);
      break;
    }
    case 'metric': {
      const metrics = node.metrics ?? [];
      if (metrics.length > 0) {
        blocks.push(
          metrics
            .map((m) => `- **${m.label}**: ${m.value}${m.change ? ` (${m.change})` : ''}`)
            .join('\n')
        );
      }
      break;
    }
    case 'list': {
      const items = node.listItems ?? [];
      if (items.length > 0) blocks.push(items.map((i) => `- ${i}`).join('\n'));
      break;
    }
  }

  return blocks.join('\n\n');
}

export function answerToMarkdown(source: ArticleQaSource): string {
  return `### ${source.question}\n\n${source.answer}`;
}

export function workspaceNodeToMarkdown(
  node: WorkspaceNode,
  qaSources: ArticleQaSource[]
): string {
  if (node.type === 'data') return dataNodeToMarkdown(node);
  if (node.type === 'answer') {
    const source = qaSources.find((s) => s.answerId === node.id);
    return source ? answerToMarkdown(source) : node.content.trim();
  }
  return '';
}

/** Title and subtitle live in their own fields; they are only merged into the exported file. */
export function buildArticleFileMarkdown(draft: ArticleDraft): string {
  const blocks: string[] = [];
  if (draft.title.trim()) blocks.push(`# ${draft.title.trim()}`);
  if (draft.subtitle.trim()) blocks.push(`_${draft.subtitle.trim()}_`);
  if (draft.body.trim()) blocks.push(draft.body.trim());
  return `${blocks.join('\n\n')}\n`;
}

/** Parses the `TITLE:` / `SUBTITLE:` / `---` header the seed prompt asks for. */
export function parseSeedDraft(raw: string): ArticleDraft {
  const text = raw.replace(/\r\n/g, '\n').trim();
  const lines = text.split('\n');
  let title = '';
  let subtitle = '';
  let bodyStart = 0;

  for (let i = 0; i < Math.min(lines.length, 6); i++) {
    const line = lines[i].trim();
    if (!line) {
      bodyStart = i + 1;
      continue;
    }
    const titleMatch = /^TITLE\s*:\s*(.*)$/i.exec(line);
    if (titleMatch) {
      title = titleMatch[1].trim().replace(/^#+\s*/, '');
      bodyStart = i + 1;
      continue;
    }
    const subtitleMatch = /^SUBTITLE\s*:\s*(.*)$/i.exec(line);
    if (subtitleMatch) {
      subtitle = subtitleMatch[1].trim();
      bodyStart = i + 1;
      continue;
    }
    if (line === ARTICLE_SEED_SEPARATOR) {
      bodyStart = i + 1;
      break;
    }
    break;
  }

  const body = lines.slice(bodyStart).join('\n').trim();
  return { title, subtitle, body: body || (title ? '' : text) };
}

export interface ArticleMessageSegment {
  kind: 'text' | 'proposal';
  content: string;
  /** False while a proposal fence is still streaming. */
  complete: boolean;
}

const PROPOSAL_OPEN = new RegExp(`^\\s*\`\`\`${ARTICLE_PROPOSAL_FENCE}\\s*$`);

/** Splits an assistant reply into conversation text and applicable proposal blocks. */
export function splitProposalSegments(raw: string): ArticleMessageSegment[] {
  const segments: ArticleMessageSegment[] = [];
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  let buffer: string[] = [];
  let inProposal = false;
  let nestedDepth = 0;

  const flush = (kind: ArticleMessageSegment['kind'], complete: boolean) => {
    const content = buffer.join('\n').trim();
    buffer = [];
    if (content) segments.push({ kind, content, complete });
  };

  for (const line of lines) {
    if (!inProposal) {
      if (PROPOSAL_OPEN.test(line)) {
        flush('text', true);
        inProposal = true;
        nestedDepth = 0;
        continue;
      }
      buffer.push(line);
      continue;
    }

    const fence = line.trimStart().startsWith('```');
    if (fence) {
      const isBareFence = line.trim() === '```';
      if (isBareFence && nestedDepth === 0) {
        flush('proposal', true);
        inProposal = false;
        continue;
      }
      nestedDepth = isBareFence ? Math.max(0, nestedDepth - 1) : nestedDepth + 1;
    }
    buffer.push(line);
  }

  flush(inProposal ? 'proposal' : 'text', !inProposal);
  return segments;
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  // Latin words plus CJK characters, which are not separated by spaces.
  const latin = trimmed.replace(/[\u3000-\u9fff\uac00-\ud7af]/g, ' ').match(/\S+/g)?.length ?? 0;
  const cjk = trimmed.match(/[\u3000-\u9fff\uac00-\ud7af]/g)?.length ?? 0;
  return latin + cjk;
}
