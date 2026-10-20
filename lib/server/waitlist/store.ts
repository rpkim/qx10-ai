import path from 'path';
import { FileWaitlistStore } from './file-store';
import { SupabaseWaitlistStore, isWaitlistDbConfigured } from './supabase-store';
import type { WaitlistStore } from './types';

let cached: WaitlistStore | null = null;
let cachedKind: 'supabase' | 'file' | null = null;

export function getWaitlistStore(): WaitlistStore {
  if (cached) return cached;
  if (isWaitlistDbConfigured()) {
    cached = new SupabaseWaitlistStore();
    cachedKind = 'supabase';
  } else {
    const dir = process.env.QX10_DATA_DIR || path.join(process.cwd(), '.qx10-data');
    cached = new FileWaitlistStore(dir);
    cachedKind = 'file';
  }
  return cached;
}

export function getWaitlistStoreKind(): 'supabase' | 'file' | null {
  if (!cached) getWaitlistStore();
  return cachedKind;
}
