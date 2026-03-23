import type { GoalType } from './types';

/**
 * Build `/workspace` URL.
 * Omit `ws` (or leave undefined) to start a **new** browser session (`ws` = new timestamp).
 * Pass the current `ws` from the URL (or `'default'` if missing) to keep the same session.
 */
export function workspaceUrl(opts: {
  keyword: string;
  goal: GoalType | string;
  ws?: string;
}): string {
  const keyword = opts.keyword.trim();
  const ws = opts.ws !== undefined && opts.ws !== '' ? opts.ws : String(Date.now());
  const q = new URLSearchParams({
    keyword,
    goal: String(opts.goal),
    ws,
  });
  return `/workspace?${q.toString()}`;
}
