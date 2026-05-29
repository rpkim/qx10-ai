import type { GoalType } from './types';
import {
  fetchRecentWorkspaces,
  deleteWorkspaceFromServer,
} from './workspace-api';

export interface WorkspaceIndexEntry {
  keyword: string;
  goal: GoalType;
  context?: string;
  updatedAt: string;
}

/** @deprecated Use fetchRecentWorkspaces() — kept for sync callers during transition. */
export function listRecentWorkspaces(_limit = 12): WorkspaceIndexEntry[] {
  return [];
}

export async function listRecentWorkspacesAsync(limit = 12): Promise<WorkspaceIndexEntry[]> {
  return fetchRecentWorkspaces(limit);
}

export async function registerWorkspaceVisit(
  keyword: string,
  goal: GoalType,
  context?: string
): Promise<void> {
  void keyword;
  void goal;
  void context;
  // Recent index is derived from workspace rows on the server (updated_at on save).
}

export async function removeWorkspaceVisit(keyword: string): Promise<void> {
  await deleteWorkspaceFromServer(keyword);
}
