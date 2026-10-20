import path from 'path';
import { isPostgresConfigured } from '@/lib/server/db/pool';
import { FileAnalyticsStore } from './file-store';
import { PostgresAnalyticsStore } from './postgres-store';
import { SupabaseAnalyticsStore, isSupabaseConfigured } from './supabase-store';
import type { AnalyticsStore } from './types';

export type AnalyticsStoreKind = 'postgres' | 'supabase' | 'file';

let cached: AnalyticsStore | null = null;
let cachedKind: AnalyticsStoreKind | null = null;

export function getAnalyticsStore(): AnalyticsStore {
  if (cached) return cached;
  if (isPostgresConfigured()) {
    cached = new PostgresAnalyticsStore();
    cachedKind = 'postgres';
  } else if (isSupabaseConfigured()) {
    cached = new SupabaseAnalyticsStore();
    cachedKind = 'supabase';
  } else {
    const dir = process.env.QX10_DATA_DIR || path.join(process.cwd(), '.qx10-data');
    cached = new FileAnalyticsStore(path.join(dir, 'analytics.json'));
    cachedKind = 'file';
  }
  return cached;
}

export function getAnalyticsStoreKind(): AnalyticsStoreKind | null {
  if (!cached) getAnalyticsStore();
  return cachedKind;
}
