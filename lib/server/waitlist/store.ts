import path from 'path';
import { isPostgresConfigured } from '@/lib/server/db/pool';
import { FileWaitlistStore } from './file-store';
import { PostgresWaitlistStore } from './postgres-store';
import { SupabaseWaitlistStore, isWaitlistDbConfigured } from './supabase-store';
import type { WaitlistStore } from './types';

export type WaitlistStoreKind = 'postgres' | 'supabase' | 'file';

let cached: WaitlistStore | null = null;
let cachedKind: WaitlistStoreKind | null = null;

export function getWaitlistStore(): WaitlistStore {
  if (cached) return cached;
  if (isPostgresConfigured()) {
    cached = new PostgresWaitlistStore();
    cachedKind = 'postgres';
  } else if (isWaitlistDbConfigured()) {
    cached = new SupabaseWaitlistStore();
    cachedKind = 'supabase';
  } else {
    const dir = process.env.QX10_DATA_DIR || path.join(process.cwd(), '.qx10-data');
    cached = new FileWaitlistStore(dir);
    cachedKind = 'file';
  }
  return cached;
}

export function getWaitlistStoreKind(): WaitlistStoreKind | null {
  if (!cached) getWaitlistStore();
  return cachedKind;
}
