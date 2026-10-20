import path from 'path';
import { FileAnalyticsStore } from './file-store';
import { SupabaseAnalyticsStore, isSupabaseConfigured } from './supabase-store';
import type { AnalyticsStore } from './types';

let cached: AnalyticsStore | null = null;
let cachedKind: 'supabase' | 'file' | null = null;

export function getAnalyticsStore(): AnalyticsStore {
  if (cached) return cached;
  if (isSupabaseConfigured()) {
    cached = new SupabaseAnalyticsStore();
    cachedKind = 'supabase';
  } else {
    const dir = process.env.QX10_DATA_DIR || path.join(process.cwd(), '.qx10-data');
    cached = new FileAnalyticsStore(path.join(dir, 'analytics.json'));
    cachedKind = 'file';
  }
  return cached;
}

export function getAnalyticsStoreKind(): 'supabase' | 'file' | null {
  if (!cached) getAnalyticsStore();
  return cachedKind;
}
