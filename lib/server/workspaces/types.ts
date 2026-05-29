import type { GoalType } from '@/lib/types';
import type { WorkspaceSnapshotFile } from '@/lib/workspace-snapshot';
import type { DashboardGridItem } from '@/lib/dashboard-layout-storage';

export interface WorkspaceIndexRow {
  keyword: string;
  goal: GoalType;
  context?: string;
  updatedAt: string;
}

export interface WorkspaceStore {
  listIndex(userSub: string): Promise<WorkspaceIndexRow[]>;
  getSnapshot(userSub: string, keyword: string): Promise<WorkspaceSnapshotFile | null>;
  upsertSnapshot(userSub: string, snapshot: WorkspaceSnapshotFile): Promise<void>;
  deleteWorkspace(userSub: string, keyword: string): Promise<boolean>;
  deleteAllForUser(userSub: string): Promise<void>;
  getDashboardLayout(userSub: string, keyword: string): Promise<DashboardGridItem[] | null>;
  saveDashboardLayout(userSub: string, keyword: string, layout: DashboardGridItem[]): Promise<void>;
  deleteDashboardLayout(userSub: string, keyword: string): Promise<void>;
  getUserPrefs(userSub: string): Promise<Record<string, unknown>>;
  saveUserPrefs(userSub: string, prefs: Record<string, unknown>): Promise<void>;
  exportAllForUser(userSub: string): Promise<{
    workspaces: WorkspaceSnapshotFile[];
    dashboardLayouts: Record<string, DashboardGridItem[]>;
    prefs: Record<string, unknown>;
  }>;
}
