import type { GoalType } from './types';

const INDEX_KEY = 'qx10.workspace.index.v1';

export interface WorkspaceIndexEntry {
  keyword: string;
  goal: GoalType;
  context?: string;
  updatedAt: string;
}

function readRaw(): WorkspaceIndexEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    return data.filter(
      (e): e is WorkspaceIndexEntry =>
        e &&
        typeof e === 'object' &&
        typeof (e as WorkspaceIndexEntry).keyword === 'string' &&
        typeof (e as WorkspaceIndexEntry).goal === 'string' &&
        typeof (e as WorkspaceIndexEntry).updatedAt === 'string'
    );
  } catch {
    return [];
  }
}

export function listRecentWorkspaces(limit = 12): WorkspaceIndexEntry[] {
  return readRaw().slice(0, limit);
}

export function registerWorkspaceVisit(keyword: string, goal: GoalType, context?: string): void {
  if (typeof window === 'undefined' || !keyword.trim()) return;
  const kw = keyword.trim();
  const list = readRaw().filter((e) => e.keyword !== kw);
  list.unshift({
    keyword: kw,
    goal,
    ...(context ? { context } : {}),
    updatedAt: new Date().toISOString(),
  });
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(list.slice(0, 24)));
  } catch {
    /* ignore quota */
  }
}

export function removeWorkspaceVisit(keyword: string): void {
  if (typeof window === 'undefined' || !keyword.trim()) return;
  const kw = keyword.trim();
  const list = readRaw().filter((e) => e.keyword !== kw);
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(list));
  } catch {
    /* ignore quota */
  }
}
