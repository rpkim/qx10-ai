/**
 * Workspace `context` is stored as a single string (URL param, DB column, snapshot field) for
 * backward compatibility, but the UI lets users add multiple chips — plain keywords or URLs.
 * Chips are newline-delimited internally; a legacy single-line context still parses as one chip.
 */
const CONTEXT_ITEM_DELIMITER = '\n';

export interface ContextItem {
  value: string;
  isUrl: boolean;
}

export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function parseContextItems(context?: string | null): ContextItem[] {
  if (!context) return [];
  return context
    .split(CONTEXT_ITEM_DELIMITER)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((value) => ({ value, isUrl: isHttpUrl(value) }));
}

export function joinContextItems(values: string[]): string {
  return values
    .map((s) => s.trim())
    .filter(Boolean)
    .join(CONTEXT_ITEM_DELIMITER);
}

/** Human-readable single-line rendering for lists/subtitles (e.g. "in \"a, b\""). */
export function formatContextForDisplay(context?: string | null): string {
  return parseContextItems(context)
    .map((i) => i.value)
    .join(', ');
}

export function contextHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
