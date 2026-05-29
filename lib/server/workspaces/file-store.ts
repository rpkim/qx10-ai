import { promises as fs } from 'fs';
import path from 'path';
import type { DashboardGridItem } from '@/lib/dashboard-layout-storage';
import type { GoalType } from '@/lib/types';
import type { WorkspaceSnapshotFile } from '@/lib/workspace-snapshot';
import type { WorkspaceIndexRow, WorkspaceStore } from './types';

type UserFileShape = {
  workspaces: Record<string, WorkspaceSnapshotFile>;
  dashboardLayouts: Record<string, DashboardGridItem[]>;
  prefs: Record<string, unknown>;
};

function emptyUser(): UserFileShape {
  return { workspaces: {}, dashboardLayouts: {}, prefs: {} };
}

export class FileWorkspaceStore implements WorkspaceStore {
  private readonly dir: string;
  private chain: Promise<unknown> = Promise.resolve();

  constructor(dir: string) {
    this.dir = dir;
  }

  private userPath(userSub: string): string {
    const safe = userSub.replace(/[^a-zA-Z0-9._-]/g, '_');
    return path.join(this.dir, `${safe}.json`);
  }

  private async readUser(userSub: string): Promise<UserFileShape> {
    const file = this.userPath(userSub);
    try {
      const raw = await fs.readFile(file, 'utf8');
      const data = JSON.parse(raw) as UserFileShape;
      return {
        workspaces: data.workspaces ?? {},
        dashboardLayouts: data.dashboardLayouts ?? {},
        prefs: data.prefs ?? {},
      };
    } catch {
      return emptyUser();
    }
  }

  private async writeUser(userSub: string, data: UserFileShape): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
    await fs.writeFile(this.userPath(userSub), JSON.stringify(data, null, 2), 'utf8');
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.chain.then(fn, fn);
    this.chain = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  }

  async listIndex(userSub: string): Promise<WorkspaceIndexRow[]> {
    return this.enqueue(async () => {
      const data = await this.readUser(userSub);
      return Object.values(data.workspaces)
        .map((s) => ({
          keyword: s.keyword,
          goal: s.goal as GoalType,
          ...(s.context ? { context: s.context } : {}),
          updatedAt: s.savedAt ?? new Date().toISOString(),
        }))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 24);
    });
  }

  async getSnapshot(userSub: string, keyword: string): Promise<WorkspaceSnapshotFile | null> {
    return this.enqueue(async () => {
      const data = await this.readUser(userSub);
      return data.workspaces[keyword] ?? null;
    });
  }

  async upsertSnapshot(userSub: string, snapshot: WorkspaceSnapshotFile): Promise<void> {
    return this.enqueue(async () => {
      const data = await this.readUser(userSub);
      data.workspaces[snapshot.keyword] = {
        ...snapshot,
        savedAt: snapshot.savedAt ?? new Date().toISOString(),
      };
      await this.writeUser(userSub, data);
    });
  }

  async deleteWorkspace(userSub: string, keyword: string): Promise<boolean> {
    return this.enqueue(async () => {
      const data = await this.readUser(userSub);
      if (!data.workspaces[keyword]) return false;
      delete data.workspaces[keyword];
      delete data.dashboardLayouts[keyword];
      await this.writeUser(userSub, data);
      return true;
    });
  }

  async deleteAllForUser(userSub: string): Promise<void> {
    return this.enqueue(async () => {
      try {
        await fs.unlink(this.userPath(userSub));
      } catch {
        /* ignore */
      }
    });
  }

  async getDashboardLayout(userSub: string, keyword: string): Promise<DashboardGridItem[] | null> {
    return this.enqueue(async () => {
      const data = await this.readUser(userSub);
      const layout = data.dashboardLayouts[keyword];
      return layout?.length ? layout : null;
    });
  }

  async saveDashboardLayout(
    userSub: string,
    keyword: string,
    layout: DashboardGridItem[]
  ): Promise<void> {
    return this.enqueue(async () => {
      const data = await this.readUser(userSub);
      data.dashboardLayouts[keyword] = layout;
      await this.writeUser(userSub, data);
    });
  }

  async deleteDashboardLayout(userSub: string, keyword: string): Promise<void> {
    return this.enqueue(async () => {
      const data = await this.readUser(userSub);
      delete data.dashboardLayouts[keyword];
      await this.writeUser(userSub, data);
    });
  }

  async getUserPrefs(userSub: string): Promise<Record<string, unknown>> {
    return this.enqueue(async () => {
      const data = await this.readUser(userSub);
      return data.prefs;
    });
  }

  async saveUserPrefs(userSub: string, prefs: Record<string, unknown>): Promise<void> {
    return this.enqueue(async () => {
      const data = await this.readUser(userSub);
      data.prefs = prefs;
      await this.writeUser(userSub, data);
    });
  }

  async exportAllForUser(userSub: string) {
    return this.enqueue(async () => {
      const data = await this.readUser(userSub);
      return {
        workspaces: Object.values(data.workspaces),
        dashboardLayouts: data.dashboardLayouts,
        prefs: data.prefs,
      };
    });
  }
}
