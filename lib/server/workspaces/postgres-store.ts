import type { StoredArticleDraft } from '@/lib/article-draft-storage';
import { parseStoredArticleDraft } from '@/lib/article-draft-storage';
import type { DashboardGridItem } from '@/lib/dashboard-layout-storage';
import { query, queryOne } from '@/lib/server/db/pool';
import type { GoalType } from '@/lib/types';
import type { WorkspaceSnapshotFile } from '@/lib/workspace-snapshot';
import type { WorkspaceIndexRow, WorkspaceStore } from './types';

function asIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

export class PostgresWorkspaceStore implements WorkspaceStore {
  async listIndex(userSub: string): Promise<WorkspaceIndexRow[]> {
    const rows = await query<{
      keyword: string;
      goal: string;
      context: string | null;
      updated_at: string | Date;
    }>(
      `select keyword, goal, context, updated_at
         from qx10_workspaces
        where user_sub = $1
        order by updated_at desc
        limit 24`,
      [userSub]
    );
    return rows.map((row) => ({
      keyword: row.keyword,
      goal: row.goal as GoalType,
      ...(row.context ? { context: row.context } : {}),
      updatedAt: asIso(row.updated_at),
    }));
  }

  async getSnapshot(userSub: string, keyword: string): Promise<WorkspaceSnapshotFile | null> {
    const row = await queryOne<{ snapshot: WorkspaceSnapshotFile }>(
      'select snapshot from qx10_workspaces where user_sub = $1 and keyword = $2',
      [userSub, keyword]
    );
    return row?.snapshot ?? null;
  }

  async upsertSnapshot(userSub: string, snapshot: WorkspaceSnapshotFile): Promise<void> {
    const now = new Date().toISOString();
    await query(
      `insert into qx10_workspaces
         (user_sub, keyword, goal, context, snapshot, saved_at, updated_at)
       values ($1, $2, $3, $4, $5::jsonb, $6, $7)
       on conflict (user_sub, keyword) do update set
         goal = excluded.goal,
         context = excluded.context,
         snapshot = excluded.snapshot,
         saved_at = excluded.saved_at,
         updated_at = excluded.updated_at`,
      [
        userSub,
        snapshot.keyword,
        snapshot.goal,
        snapshot.context ?? null,
        JSON.stringify(snapshot),
        snapshot.savedAt ?? now,
        now,
      ]
    );
  }

  async deleteWorkspace(userSub: string, keyword: string): Promise<boolean> {
    const rows = await query<{ keyword: string }>(
      'delete from qx10_workspaces where user_sub = $1 and keyword = $2 returning keyword',
      [userSub, keyword]
    );
    await this.deleteDashboardLayout(userSub, keyword);
    await this.deleteArticleDraft(userSub, keyword);
    return rows.length > 0;
  }

  async deleteAllForUser(userSub: string): Promise<void> {
    await query('delete from qx10_workspaces where user_sub = $1', [userSub]);
    await query('delete from qx10_dashboard_layouts where user_sub = $1', [userSub]);
    await query('delete from qx10_article_drafts where user_sub = $1', [userSub]);
    await query('delete from qx10_user_prefs where user_sub = $1', [userSub]);
  }

  async getDashboardLayout(userSub: string, keyword: string): Promise<DashboardGridItem[] | null> {
    const row = await queryOne<{ layout: DashboardGridItem[] }>(
      'select layout from qx10_dashboard_layouts where user_sub = $1 and keyword = $2',
      [userSub, keyword]
    );
    return row?.layout?.length ? row.layout : null;
  }

  async saveDashboardLayout(userSub: string, keyword: string, layout: DashboardGridItem[]): Promise<void> {
    await query(
      `insert into qx10_dashboard_layouts (user_sub, keyword, layout, updated_at)
       values ($1, $2, $3::jsonb, now())
       on conflict (user_sub, keyword) do update set
         layout = excluded.layout,
         updated_at = excluded.updated_at`,
      [userSub, keyword, JSON.stringify(layout)]
    );
  }

  async deleteDashboardLayout(userSub: string, keyword: string): Promise<void> {
    await query('delete from qx10_dashboard_layouts where user_sub = $1 and keyword = $2', [userSub, keyword]);
  }

  async getArticleDraft(userSub: string, keyword: string): Promise<StoredArticleDraft | null> {
    const row = await queryOne<{ draft: unknown }>(
      'select draft from qx10_article_drafts where user_sub = $1 and keyword = $2',
      [userSub, keyword]
    );
    return parseStoredArticleDraft(row?.draft) ?? null;
  }

  async saveArticleDraft(userSub: string, keyword: string, draft: StoredArticleDraft): Promise<void> {
    await query(
      `insert into qx10_article_drafts (user_sub, keyword, draft, updated_at)
       values ($1, $2, $3::jsonb, now())
       on conflict (user_sub, keyword) do update set
         draft = excluded.draft,
         updated_at = excluded.updated_at`,
      [userSub, keyword, JSON.stringify(draft)]
    );
  }

  async deleteArticleDraft(userSub: string, keyword: string): Promise<void> {
    await query('delete from qx10_article_drafts where user_sub = $1 and keyword = $2', [userSub, keyword]);
  }

  async getUserPrefs(userSub: string): Promise<Record<string, unknown>> {
    const row = await queryOne<{ prefs: Record<string, unknown> }>(
      'select prefs from qx10_user_prefs where user_sub = $1',
      [userSub]
    );
    return row?.prefs ?? {};
  }

  async saveUserPrefs(userSub: string, prefs: Record<string, unknown>): Promise<void> {
    await query(
      `insert into qx10_user_prefs (user_sub, prefs, updated_at)
       values ($1, $2::jsonb, now())
       on conflict (user_sub) do update set
         prefs = excluded.prefs,
         updated_at = excluded.updated_at`,
      [userSub, JSON.stringify(prefs)]
    );
  }

  async exportAllForUser(userSub: string) {
    const [index, prefs] = await Promise.all([this.listIndex(userSub), this.getUserPrefs(userSub)]);
    const workspaces: WorkspaceSnapshotFile[] = [];
    const dashboardLayouts: Record<string, DashboardGridItem[]> = {};
    const articleDrafts: Record<string, StoredArticleDraft> = {};
    for (const row of index) {
      const snap = await this.getSnapshot(userSub, row.keyword);
      if (snap) workspaces.push(snap);
      const layout = await this.getDashboardLayout(userSub, row.keyword);
      if (layout) dashboardLayouts[row.keyword] = layout;
      const article = await this.getArticleDraft(userSub, row.keyword);
      if (article) articleDrafts[row.keyword] = article;
    }
    const orphanDrafts = await query<{ keyword: string; draft: unknown }>(
      'select keyword, draft from qx10_article_drafts where user_sub = $1',
      [userSub]
    );
    for (const row of orphanDrafts) {
      if (articleDrafts[row.keyword]) continue;
      const draft = parseStoredArticleDraft(row.draft);
      if (draft) articleDrafts[row.keyword] = draft;
    }
    return { workspaces, dashboardLayouts, articleDrafts, prefs };
  }
}
