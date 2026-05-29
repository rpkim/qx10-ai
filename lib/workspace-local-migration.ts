import type { DashboardGridItem } from '@/lib/dashboard-layout-storage';
import {
  listAllWorkspaceKeywordsInLocalStorage,
  loadWorkspaceFromLocalStorage,
  serializeWorkspaceSnapshot,
} from '@/lib/workspace-snapshot';
import { migrateLocalWorkspacesToServer } from '@/lib/workspace-api';

const DASHBOARD_PREFIX = 'qx10.dashboard.grid.v1:';

function loadLocalDashboardLayouts(): Record<string, DashboardGridItem[]> {
  if (typeof window === 'undefined') return {};
  const out: Record<string, DashboardGridItem[]> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k?.startsWith(DASHBOARD_PREFIX)) continue;
    const encoded = k.slice(DASHBOARD_PREFIX.length);
    try {
      const keyword = decodeURIComponent(encoded);
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed) && parsed.length) {
        out[keyword] = parsed as DashboardGridItem[];
      }
    } catch {
      /* skip */
    }
  }
  return out;
}

export function hasLocalWorkspaceData(): boolean {
  if (typeof window === 'undefined') return false;
  return listAllWorkspaceKeywordsInLocalStorage().length > 0;
}

export async function migrateBrowserLocalStorageToServer(): Promise<number> {
  const keywords = listAllWorkspaceKeywordsInLocalStorage();
  const snapshots: string[] = [];
  for (const kw of keywords) {
    const loaded = loadWorkspaceFromLocalStorage(kw);
    if (!loaded.ok) continue;
    snapshots.push(serializeWorkspaceSnapshot(loaded.state));
  }
  const dashboardLayouts = loadLocalDashboardLayouts();
  const { migrated } = await migrateLocalWorkspacesToServer({ snapshots, dashboardLayouts });
  for (const kw of keywords) {
    try {
      localStorage.removeItem(`qx10.workspace.v1:${encodeURIComponent(kw)}`);
    } catch {
      /* ignore */
    }
  }
  for (const k of Object.keys(dashboardLayouts)) {
    try {
      localStorage.removeItem(`${DASHBOARD_PREFIX}${encodeURIComponent(k)}`);
    } catch {
      /* ignore */
    }
  }
  try {
    localStorage.removeItem('qx10.workspace.index.v1');
  } catch {
    /* ignore */
  }
  return migrated;
}
