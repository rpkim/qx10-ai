/**
 * Expanded dashboard widget positions (percent of the board, 0–100).
 * Stored per keyword until a DB exists.
 */
export type DashboardGridItem = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

const PREFIX = 'qx10.dashboard.grid.v1:';

function keyFor(keyword: string): string {
  return `${PREFIX}${encodeURIComponent(keyword.trim())}`;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function loadDashboardGrid(keyword: string): DashboardGridItem[] | null {
  if (typeof window === 'undefined' || !keyword.trim()) return null;
  try {
    const raw = localStorage.getItem(keyFor(keyword));
    if (!raw) return null;
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return null;
    const out: DashboardGridItem[] = [];
    for (const row of data) {
      if (!row || typeof row !== 'object') continue;
      const r = row as Record<string, unknown>;
      if (typeof r.id !== 'string') continue;
      const x = Number(r.x);
      const y = Number(r.y);
      const w = Number(r.w);
      const h = Number(r.h);
      if (![x, y, w, h].every((n) => Number.isFinite(n))) continue;
      out.push({
        id: r.id,
        x: clamp(x, 0, 100),
        y: clamp(y, 0, 100),
        w: clamp(w, 12, 100),
        h: clamp(h, 10, 100),
      });
    }
    return out.length ? out : null;
  } catch {
    return null;
  }
}

export function saveDashboardGrid(keyword: string, items: DashboardGridItem[]): void {
  if (typeof window === 'undefined' || !keyword.trim()) return;
  try {
    localStorage.setItem(keyFor(keyword.trim()), JSON.stringify(items));
  } catch {
    /* ignore */
  }
}

export function removeDashboardGrid(keyword: string): void {
  if (typeof window === 'undefined' || !keyword.trim()) return;
  try {
    localStorage.removeItem(keyFor(keyword.trim()));
  } catch {
    /* ignore */
  }
}

export function defaultGridLayout(pinnedIds: string[]): DashboardGridItem[] {
  if (pinnedIds.length === 0) return [];
  const cols = 2;
  const gap = 2;
  const cellW = (100 - gap * (cols + 1)) / cols;
  const rows = Math.ceil(pinnedIds.length / cols);
  const rowH = Math.max(14, (100 - gap * (rows + 1)) / rows);
  return pinnedIds.map((id, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    return {
      id,
      x: gap + col * (cellW + gap),
      y: gap + row * (rowH + gap),
      w: cellW,
      h: rowH,
    };
  });
}

export function mergeLayoutWithPins(
  saved: DashboardGridItem[] | null,
  pinnedIds: string[]
): DashboardGridItem[] {
  const defaults = defaultGridLayout(pinnedIds);
  const map = new Map((saved ?? []).map((s) => [s.id, s]));
  return pinnedIds.map((id, i) => {
    const s = map.get(id);
    const d = defaults[i] ?? defaults[defaults.length - 1];
    if (!s) return d;
    const w = clamp(s.w, 12, 100);
    const h = clamp(s.h, 10, 100);
    return {
      id,
      x: clamp(s.x, 0, 100 - w),
      y: clamp(s.y, 0, 100 - h),
      w,
      h,
    };
  });
}
