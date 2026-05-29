import path from 'path';
import { FileWorkspaceStore } from './file-store';
import { SupabaseWorkspaceStore, isWorkspaceDbConfigured } from './supabase-store';
import type { WorkspaceStore } from './types';

let cached: WorkspaceStore | null = null;
let cachedKind: 'supabase' | 'file' | null = null;

export function getWorkspaceStore(): WorkspaceStore {
  if (cached) return cached;
  if (isWorkspaceDbConfigured()) {
    cached = new SupabaseWorkspaceStore();
    cachedKind = 'supabase';
  } else {
    const dir = process.env.QX10_DATA_DIR || path.join(process.cwd(), '.qx10-data');
    cached = new FileWorkspaceStore(path.join(dir, 'workspaces'));
    cachedKind = 'file';
  }
  return cached;
}

export function getWorkspaceStoreKind(): 'supabase' | 'file' | null {
  if (!cached) getWorkspaceStore();
  return cachedKind;
}
