/**
 * Dashboard widget positions (percent of the board, 0–100).
 * Persisted per user + keyword on the server; in-memory cache for sync reads in UI.
 */
export type DashboardGridItem = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

const cache = new Map<string, DashboardGridItem[]>();

function cacheKey(keyword: string): string {
  return keyword.trim();
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function saveDashboardGridCache(keyword: string, items: DashboardGridItem[]): void {
  if (!keyword.trim()) return;
  cache.set(cacheKey(keyword), items);
}

export function loadDashboardGrid(keyword: string): DashboardGridItem[] | null {
  if (!keyword.trim()) return null;
  const hit = cache.get(cacheKey(keyword));
  return hit?.length ? hit : null;
}

export async function loadDashboardGridAsync(keyword: string): Promise<DashboardGridItem[] | null> {
  const cached = loadDashboardGrid(keyword);
  if (cached) return cached;
  const { fetchDashboardLayoutFromServer } = await import('./workspace-api');
  const layout = await fetchDashboardLayoutFromServer(keyword);
  if (layout?.length) saveDashboardGridCache(keyword, layout);
  return layout;
}

export function saveDashboardGrid(keyword: string, items: DashboardGridItem[]): void {
  if (!keyword.trim()) return;
  saveDashboardGridCache(keyword, items);
  void import('./workspace-api').then(({ saveDashboardLayoutToServer }) =>
    saveDashboardLayoutToServer(keyword, items)
  );
}

export function removeDashboardGrid(keyword: string): void {
  if (!keyword.trim()) return;
  cache.delete(cacheKey(keyword));
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

/** Collect all cached dashboard layouts (for one-time local → server migration). */
export function collectCachedDashboardLayouts(): Record<string, DashboardGridItem[]> {
  const out: Record<string, DashboardGridItem[]> = {};
  for (const [kw, layout] of cache) {
    if (layout.length) out[kw] = layout;
  }
  return out;
}
