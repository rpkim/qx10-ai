type Json = Record<string, unknown>;

function readString(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function compactQuery(question: string, maxLen = 400): string {
  return question.replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

function tavilyApiKey(): string | undefined {
  const k = process.env.TAVILY_API_KEY?.trim();
  return k || undefined;
}

function clip(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

async function maybeGetTavilySearchDataNode(question: string): Promise<
  | {
      payload: {
        dataType: 'list';
        title: string;
        subtitle?: string;
        listItems: string[];
      };
      keywords: string[];
    }
  | null
> {
  const apiKey = tavilyApiKey();
  if (!apiKey) return null;

  const q = compactQuery(question);
  if (!q) return null;

  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query: q,
        search_depth: 'basic',
        max_results: 6,
        include_answer: true,
      }),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as unknown;
    const obj = json && typeof json === 'object' ? (json as Json) : null;
    if (!obj) return null;

    const listItems: string[] = [];
    const answer = readString(obj.answer);
    if (answer) listItems.push(clip(answer, 900));

    const results = Array.isArray(obj.results) ? obj.results : [];
    for (const row of results) {
      if (listItems.length >= 8) break;
      if (!row || typeof row !== 'object') continue;
      const r = row as Json;
      const title = readString(r.title);
      const content = readString(r.content);
      const url = readString(r.url);
      if (content) {
        const head = title ? `${title} — ` : '';
        listItems.push(clip(`${head}${content}`, 520));
      } else if (title && url) {
        listItems.push(clip(`${title} (${url})`, 400));
      } else if (title) {
        listItems.push(title);
      }
    }

    if (listItems.length === 0) return null;
    return {
      payload: {
        dataType: 'list',
        title: 'Web search highlights',
        subtitle: `Tavily · ${q}`,
        listItems: listItems.slice(0, 8),
      },
      keywords: ['Web Search', 'Tavily'],
    };
  } catch {
    return null;
  }
}

function toItems(raw: unknown): string[] {
  const obj = raw && typeof raw === 'object' ? (raw as Json) : null;
  if (!obj) return [];

  const out: string[] = [];
  const abstract = readString(obj.AbstractText);
  if (abstract) out.push(abstract);

  const related = Array.isArray(obj.RelatedTopics) ? obj.RelatedTopics : [];
  for (const it of related) {
    if (out.length >= 6) break;
    if (it && typeof it === 'object') {
      const text = readString((it as Json).Text);
      if (text) out.push(text);
      const topics = Array.isArray((it as Json).Topics) ? ((it as Json).Topics as unknown[]) : [];
      for (const t of topics) {
        if (out.length >= 6) break;
        if (t && typeof t === 'object') {
          const nested = readString((t as Json).Text);
          if (nested) out.push(nested);
        }
      }
    }
  }

  return out;
}

export async function maybeGetWebSearchDataNode(question: string): Promise<
  | {
      payload: {
        dataType: 'list';
        title: string;
        subtitle?: string;
        listItems: string[];
      };
      keywords: string[];
    }
  | null
> {
  const tavily = await maybeGetTavilySearchDataNode(question);
  if (tavily) return tavily;

  const q = compactQuery(question, 160);
  if (!q) return null;

  const url = new URL('https://api.duckduckgo.com/');
  url.searchParams.set('q', q);
  url.searchParams.set('format', 'json');
  url.searchParams.set('no_html', '1');
  url.searchParams.set('skip_disambig', '1');

  try {
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) return null;
    const json = (await res.json()) as unknown;
    const items = toItems(json);
    if (items.length === 0) return null;
    return {
      payload: {
        dataType: 'list',
        title: 'Web search highlights',
        subtitle: `DuckDuckGo · ${q}`,
        listItems: items.slice(0, 6),
      },
      keywords: ['Web Search'],
    };
  } catch {
    return null;
  }
}

