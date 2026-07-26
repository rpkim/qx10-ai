import type { GoalType, WorkspaceState } from '@/lib/types';
import type { DashboardGridItem } from '@/lib/dashboard-layout-storage';
import type { StoredArticleDraft } from '@/lib/article-draft-storage';
import type { WorkspaceIndexEntry } from '@/lib/workspace-index';
import {
  parseWorkspaceSnapshot,
  type SnapshotErr,
  type SnapshotOk,
  workspaceToSnapshotPayload,
} from '@/lib/workspace-snapshot';

function keywordPath(keyword: string): string {
  return encodeURIComponent(keyword.trim());
}

export async function fetchRecentWorkspaces(limit = 12): Promise<WorkspaceIndexEntry[]> {
  const res = await fetch('/api/workspaces', { credentials: 'include' });
  if (!res.ok) return [];
  const data = (await res.json()) as { entries?: WorkspaceIndexEntry[] };
  return (data.entries ?? []).slice(0, limit);
}

export async function loadWorkspaceFromServer(
  keyword: string
): Promise<(SnapshotOk & { dashboardLayout: DashboardGridItem[] | null }) | SnapshotErr> {
  const res = await fetch(`/api/workspaces/${keywordPath(keyword)}`, { credentials: 'include' });
  if (res.status === 404) return { ok: false, code: 'no_saved' };
  if (!res.ok) return { ok: false, code: 'invalid_format' };
  const data = (await res.json()) as {
    snapshot?: unknown;
    dashboardLayout?: DashboardGridItem[] | null;
  };
  const parsed = parseWorkspaceSnapshot(data.snapshot);
  if (!parsed.ok) return parsed;
  return { ...parsed, dashboardLayout: data.dashboardLayout ?? null };
}

export async function saveWorkspaceToServer(
  state: WorkspaceState,
  dashboardLayout?: DashboardGridItem[] | null
): Promise<{ ok: true } | SnapshotErr> {
  if (!state.keyword.trim()) return { ok: false, code: 'no_keyword' };
  const snapshot = workspaceToSnapshotPayload(state);
  const res = await fetch(`/api/workspaces/${keywordPath(state.keyword)}`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      snapshot,
      dashboardLayout: dashboardLayout ?? null,
    }),
  });
  if (!res.ok) return { ok: false, code: 'storage_full' };
  return { ok: true };
}

export async function deleteWorkspaceFromServer(keyword: string): Promise<boolean> {
  const res = await fetch(`/api/workspaces/${keywordPath(keyword)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) return false;
  const data = (await res.json()) as { removed?: boolean };
  return !!data.removed;
}

export async function touchWorkspaceIndex(
  keyword: string,
  goal: GoalType,
  context?: string
): Promise<void> {
  // Index is updated automatically on snapshot upsert; no-op for API model.
  void keyword;
  void goal;
  void context;
}

export async function migrateLocalWorkspacesToServer(payload: {
  snapshots: string[];
  dashboardLayouts: Record<string, DashboardGridItem[]>;
}): Promise<{ migrated: number }> {
  const res = await fetch('/api/workspaces/migrate', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      snapshots: payload.snapshots,
      dashboardLayouts: payload.dashboardLayouts,
    }),
  });
  if (!res.ok) throw new Error('migrate_failed');
  const data = (await res.json()) as { migrated?: number };
  return { migrated: data.migrated ?? 0 };
}

export async function fetchDashboardLayoutFromServer(
  keyword: string
): Promise<DashboardGridItem[] | null> {
  const loaded = await loadWorkspaceFromServer(keyword);
  if (!loaded.ok) return null;
  return loaded.dashboardLayout;
}

export async function saveDashboardLayoutToServer(
  keyword: string,
  layout: DashboardGridItem[]
): Promise<void> {
  const loaded = await loadWorkspaceFromServer(keyword);
  if (!loaded.ok) return;
  await saveWorkspaceToServer(loaded.state, layout);
}

export async function fetchArticleDraftFromServer(
  keyword: string
): Promise<StoredArticleDraft | null> {
  if (!keyword.trim()) return null;
  const res = await fetch(`/api/workspaces/${keywordPath(keyword)}/article`, {
    credentials: 'include',
  });
  if (res.status === 401 || res.status === 404) return null;
  if (!res.ok) return null;
  const data = (await res.json()) as { draft?: StoredArticleDraft | null };
  return data.draft ?? null;
}

export async function saveArticleDraftToServer(
  keyword: string,
  draft: StoredArticleDraft
): Promise<boolean> {
  if (!keyword.trim()) return false;
  const res = await fetch(`/api/workspaces/${keywordPath(keyword)}/article`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ draft }),
  });
  return res.ok;
}

export async function fetchUserPrefs(): Promise<Record<string, unknown>> {
  const res = await fetch('/api/user/prefs', { credentials: 'include' });
  if (!res.ok) return {};
  const data = (await res.json()) as { prefs?: Record<string, unknown> };
  return data.prefs ?? {};
}

export async function saveUserPrefs(prefs: Record<string, unknown>): Promise<void> {
  await fetch('/api/user/prefs', {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefs }),
  });
}
