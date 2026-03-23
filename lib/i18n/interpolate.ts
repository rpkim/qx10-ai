export function interpolate(
  s: string,
  vars?: Record<string, string | number | undefined>
): string {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (_, k) => {
    const v = vars[k];
    return v !== undefined ? String(v) : `{${k}}`;
  });
}
