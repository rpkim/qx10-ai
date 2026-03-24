type Json = Record<string, unknown>;

function readString(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function compactQuery(question: string): string {
  return question.replace(/\s+/g, ' ').trim().slice(0, 160);
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
  const q = compactQuery(question);
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

