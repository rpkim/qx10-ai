/** Only allow same-origin relative paths for post-login redirect. */
export function safeOAuthNextPath(raw: string | null): string {
  if (!raw || typeof raw !== 'string') return '/settings';
  const s = raw.trim();
  if (!s.startsWith('/') || s.startsWith('//')) return '/settings';
  const pathOnly = s.split('?')[0]?.split('#')[0] ?? '/settings';
  return pathOnly.slice(0, 512) || '/settings';
}
