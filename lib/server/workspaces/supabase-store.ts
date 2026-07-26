import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  getSupabaseSecretKey,
  getSupabaseUrl,
  isSupabaseServerConfigured,
} from '@/lib/supabase/config';
import type { DashboardGridItem } from '@/lib/dashboard-layout-storage';
import {
  parseStoredArticleDraft,
  type StoredArticleDraft,
} from '@/lib/article-draft-storage';
import type { GoalType } from '@/lib/types';
import type { WorkspaceSnapshotFile } from '@/lib/workspace-snapshot';
import type { WorkspaceIndexRow, WorkspaceStore } from './types';

type WorkspaceRow = {
  user_sub: string;
  keyword: string;
  goal: string;
  context: string | null;
  snapshot: WorkspaceSnapshotFile;
  saved_at: string;
  updated_at: string;
};

type DashboardRow = {
  user_sub: string;
  keyword: string;
  layout: DashboardGridItem[];
  updated_at: string;
};

type ArticleDraftRow = {
  user_sub: string;
  keyword: string;
  draft: StoredArticleDraft;
  updated_at: string;
};

type PrefsRow = {
  user_sub: string;
  prefs: Record<string, unknown>;
  updated_at: string;
};

export function isWorkspaceDbConfigured(): boolean {
  return isSupabaseServerConfigured();
}

export class SupabaseWorkspaceStore implements WorkspaceStore {
  private client: SupabaseClient;

  constructor() {
    this.client = createClient(getSupabaseUrl()!, getSupabaseSecretKey()!, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { 'x-application': 'qx10-workspaces' } },
    });
  }

  async listIndex(userSub: string): Promise<WorkspaceIndexRow[]> {
    const { data, error } = await this.client
      .from('workspaces')
      .select('keyword, goal, context, updated_at')
      .eq('user_sub', userSub)
      .order('updated_at', { ascending: false })
      .limit(24);
    if (error) throw error;
    return (data ?? []).map((r) => ({
      keyword: r.keyword,
      goal: r.goal as GoalType,
      ...(r.context ? { context: r.context } : {}),
      updatedAt: r.updated_at,
    }));
  }

  async getSnapshot(userSub: string, keyword: string): Promise<WorkspaceSnapshotFile | null> {
    const { data, error } = await this.client
      .from('workspaces')
      .select('snapshot')
      .eq('user_sub', userSub)
      .eq('keyword', keyword)
      .maybeSingle();
    if (error) throw error;
    return (data?.snapshot as WorkspaceSnapshotFile | undefined) ?? null;
  }

  async upsertSnapshot(userSub: string, snapshot: WorkspaceSnapshotFile): Promise<void> {
    const now = new Date().toISOString();
    const row = {
      user_sub: userSub,
      keyword: snapshot.keyword,
      goal: snapshot.goal,
      context: snapshot.context ?? null,
      snapshot,
      saved_at: snapshot.savedAt ?? now,
      updated_at: now,
    };
    const { error } = await this.client.from('workspaces').upsert(row, {
      onConflict: 'user_sub,keyword',
    });
    if (error) throw error;
  }

  async deleteWorkspace(userSub: string, keyword: string): Promise<boolean> {
    const { error, count } = await this.client
      .from('workspaces')
      .delete({ count: 'exact' })
      .eq('user_sub', userSub)
      .eq('keyword', keyword);
    if (error) throw error;
    await this.deleteDashboardLayout(userSub, keyword);
    await this.deleteArticleDraft(userSub, keyword);
    return (count ?? 0) > 0;
  }

  async deleteAllForUser(userSub: string): Promise<void> {
    const { error: wErr } = await this.client.from('workspaces').delete().eq('user_sub', userSub);
    if (wErr) throw wErr;
    const { error: dErr } = await this.client.from('dashboard_layouts').delete().eq('user_sub', userSub);
    if (dErr) throw dErr;
    const { error: aErr } = await this.client.from('article_drafts').delete().eq('user_sub', userSub);
    if (aErr) throw aErr;
    const { error: pErr } = await this.client.from('user_prefs').delete().eq('user_sub', userSub);
    if (pErr) throw pErr;
  }

  async getDashboardLayout(userSub: string, keyword: string): Promise<DashboardGridItem[] | null> {
    const { data, error } = await this.client
      .from('dashboard_layouts')
      .select('layout')
      .eq('user_sub', userSub)
      .eq('keyword', keyword)
      .maybeSingle();
    if (error) throw error;
    const layout = data?.layout as DashboardGridItem[] | undefined;
    return layout?.length ? layout : null;
  }

  async saveDashboardLayout(
    userSub: string,
    keyword: string,
    layout: DashboardGridItem[]
  ): Promise<void> {
    const { error } = await this.client.from('dashboard_layouts').upsert(
      {
        user_sub: userSub,
        keyword,
        layout,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_sub,keyword' }
    );
    if (error) throw error;
  }

  async deleteDashboardLayout(userSub: string, keyword: string): Promise<void> {
    const { error } = await this.client
      .from('dashboard_layouts')
      .delete()
      .eq('user_sub', userSub)
      .eq('keyword', keyword);
    if (error) throw error;
  }

  async getArticleDraft(userSub: string, keyword: string): Promise<StoredArticleDraft | null> {
    const { data, error } = await this.client
      .from('article_drafts')
      .select('draft')
      .eq('user_sub', userSub)
      .eq('keyword', keyword)
      .maybeSingle();
    if (error) throw error;
    return parseStoredArticleDraft(data?.draft) ?? null;
  }

  async saveArticleDraft(
    userSub: string,
    keyword: string,
    draft: StoredArticleDraft
  ): Promise<void> {
    const { error } = await this.client.from('article_drafts').upsert(
      {
        user_sub: userSub,
        keyword,
        draft,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_sub,keyword' }
    );
    if (error) throw error;
  }

  async deleteArticleDraft(userSub: string, keyword: string): Promise<void> {
    const { error } = await this.client
      .from('article_drafts')
      .delete()
      .eq('user_sub', userSub)
      .eq('keyword', keyword);
    if (error) throw error;
  }

  async getUserPrefs(userSub: string): Promise<Record<string, unknown>> {
    const { data, error } = await this.client
      .from('user_prefs')
      .select('prefs')
      .eq('user_sub', userSub)
      .maybeSingle();
    if (error) throw error;
    return (data?.prefs as Record<string, unknown> | undefined) ?? {};
  }

  async saveUserPrefs(userSub: string, prefs: Record<string, unknown>): Promise<void> {
    const { error } = await this.client.from('user_prefs').upsert(
      {
        user_sub: userSub,
        prefs,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_sub' }
    );
    if (error) throw error;
  }

  async exportAllForUser(userSub: string) {
    const [index, prefs] = await Promise.all([
      this.listIndex(userSub),
      this.getUserPrefs(userSub),
    ]);
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
    // Also pick up article drafts whose workspace snapshot may have been deleted.
    const { data: orphanDrafts, error } = await this.client
      .from('article_drafts')
      .select('keyword, draft')
      .eq('user_sub', userSub);
    if (error) throw error;
    for (const row of orphanDrafts ?? []) {
      if (articleDrafts[row.keyword]) continue;
      const draft = parseStoredArticleDraft(row.draft);
      if (draft) articleDrafts[row.keyword] = draft;
    }
    return { workspaces, dashboardLayouts, articleDrafts, prefs };
  }
}

export type { WorkspaceRow, DashboardRow, ArticleDraftRow, PrefsRow };
