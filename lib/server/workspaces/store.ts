import path from 'path';
import { isPostgresConfigured } from '@/lib/server/db/pool';
import { FileWorkspaceStore } from './file-store';
import { PostgresWorkspaceStore } from './postgres-store';
import { SupabaseWorkspaceStore, isWorkspaceDbConfigured } from './supabase-store';
import type { WorkspaceStore } from './types';

export type WorkspaceStoreKind = 'postgres' | 'supabase' | 'file';

let cached: WorkspaceStore | null = null;
let cachedKind: WorkspaceStoreKind | null = null;

export function getWorkspaceStore(): WorkspaceStore {
  if (cached) return cached;
  if (isPostgresConfigured()) {
    cached = new PostgresWorkspaceStore();
    cachedKind = 'postgres';
  } else if (isWorkspaceDbConfigured()) {
    cached = new SupabaseWorkspaceStore();
    cachedKind = 'supabase';
  } else {
    const dir = process.env.QX10_DATA_DIR || path.join(process.cwd(), '.qx10-data');
    cached = new FileWorkspaceStore(path.join(dir, 'workspaces'));
    cachedKind = 'file';
  }
  return cached;
}

export function getWorkspaceStoreKind(): WorkspaceStoreKind | null {
  if (!cached) getWorkspaceStore();
  return cachedKind;
}
