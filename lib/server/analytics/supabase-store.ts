/**
 * Supabase (Postgres) backed analytics store. Production target.
 *
 * Required env:
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY  (server-only — never expose to the browser)
 *
 * Apply `db/schema.sql` once to your project (Supabase SQL editor).
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  ActivityEvent,
  AnalyticsStore,
  UserRecord,
} from './types';

type DbUserRow = {
  sub: string;
  email: string;
  name: string | null;
  picture: string | null;
  created_at: number;
  last_seen_at: number;
  sign_in_count: number;
  search_count: number;
  consent_at: number | null;
  consent_version: string | null;
};

type DbEventRow = {
  id: number;
  type: 'signin' | 'search' | 'consent';
  sub: string;
  email: string;
  ts: number;
  keyword: string | null;
  goal: string | null;
  surface: string | null;
  consent_version: string | null;
  name: string | null;
  picture: string | null;
};

function rowToUser(r: DbUserRow): UserRecord {
  return {
    sub: r.sub,
    email: r.email,
    name: r.name ?? undefined,
    picture: r.picture ?? undefined,
    createdAt: Number(r.created_at),
    lastSeenAt: Number(r.last_seen_at),
    signInCount: r.sign_in_count,
    searchCount: r.search_count,
    consentAt: r.consent_at == null ? undefined : Number(r.consent_at),
    consentVersion: r.consent_version ?? undefined,
  };
}

function rowToEvent(r: DbEventRow): ActivityEvent {
  if (r.type === 'search') {
    return {
      type: 'search',
      sub: r.sub,
      email: r.email,
      ts: Number(r.ts),
      keyword: r.keyword ?? '',
      goal: r.goal ?? '',
      surface: r.surface ?? undefined,
    };
  }
  if (r.type === 'consent') {
    return {
      type: 'consent',
      sub: r.sub,
      email: r.email,
      ts: Number(r.ts),
      version: r.consent_version ?? 'v?',
    };
  }
  return {
    type: 'signin',
    sub: r.sub,
    email: r.email,
    ts: Number(r.ts),
    name: r.name ?? undefined,
    picture: r.picture ?? undefined,
  };
}

export function isSupabaseConfigured(): boolean {
  return (
    !!process.env.SUPABASE_URL?.trim() &&
    !!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  );
}

export class SupabaseAnalyticsStore implements AnalyticsStore {
  private client: SupabaseClient;

  constructor() {
    const url = process.env.SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    this.client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { 'x-application': 'qx10-server' } },
    });
  }

  async upsertUserOnSignIn(input: {
    sub: string;
    email: string;
    name?: string;
    picture?: string;
    ts: number;
  }): Promise<UserRecord> {
    const { sub, email, name, picture, ts } = input;

    const { data: existing, error: getErr } = await this.client
      .from('users')
      .select('*')
      .eq('sub', sub)
      .maybeSingle<DbUserRow>();
    if (getErr) throw new Error(`upsertUser: ${getErr.message}`);

    const payload: Partial<DbUserRow> & { sub: string; email: string } = existing
      ? {
          sub,
          email,
          name: name ?? existing.name,
          picture: picture ?? existing.picture,
          last_seen_at: ts,
          sign_in_count: (existing.sign_in_count ?? 0) + 1,
        }
      : {
          sub,
          email,
          name: name ?? null,
          picture: picture ?? null,
          created_at: ts,
          last_seen_at: ts,
          sign_in_count: 1,
          search_count: 0,
        };

    const { data: upserted, error: upErr } = await this.client
      .from('users')
      .upsert(payload, { onConflict: 'sub' })
      .select('*')
      .single<DbUserRow>();
    if (upErr || !upserted) throw new Error(`upsertUser write: ${upErr?.message}`);

    const { error: evErr } = await this.client.from('events').insert({
      type: 'signin',
      sub,
      email,
      ts,
      name: name ?? null,
      picture: picture ?? null,
    });
    if (evErr) console.error('[supabase] signin event insert failed', evErr);

    return rowToUser(upserted);
  }

  async recordSearch(input: {
    sub: string;
    email: string;
    keyword: string;
    goal: string;
    surface?: string;
    ts: number;
  }): Promise<void> {
    const keyword = input.keyword.trim();
    const lower = keyword.toLowerCase();
    const { error } = await this.client.rpc('fn_record_search', {
      p_sub: input.sub,
      p_email: input.email,
      p_keyword: keyword,
      p_keyword_lower: lower,
      p_goal: input.goal,
      p_surface: input.surface ?? null,
      p_ts: input.ts,
    });
    if (error) throw new Error(`recordSearch: ${error.message}`);
  }

  async recordConsent(input: {
    sub: string;
    email: string;
    version: string;
    ts: number;
  }): Promise<void> {
    const updates = await this.client
      .from('users')
      .update({ consent_at: input.ts, consent_version: input.version })
      .eq('sub', input.sub);
    if (updates.error) console.error('[supabase] consent update failed', updates.error);

    const { error } = await this.client.from('events').insert({
      type: 'consent',
      sub: input.sub,
      email: input.email,
      ts: input.ts,
      consent_version: input.version,
    });
    if (error) throw new Error(`recordConsent: ${error.message}`);
  }

  async appendEvent(e: ActivityEvent): Promise<void> {
    const row: Partial<DbEventRow> = {
      type: e.type,
      sub: e.sub,
      email: e.email,
      ts: e.ts,
    };
    if (e.type === 'search') {
      row.keyword = e.keyword;
      row.goal = e.goal;
      row.surface = e.surface ?? null;
    } else if (e.type === 'consent') {
      row.consent_version = e.version;
    } else if (e.type === 'signin') {
      row.name = e.name ?? null;
      row.picture = e.picture ?? null;
    }
    const { error } = await this.client.from('events').insert(row);
    if (error) throw new Error(`appendEvent: ${error.message}`);
  }

  async countUsers(): Promise<number> {
    const { count, error } = await this.client
      .from('users')
      .select('*', { head: true, count: 'exact' });
    if (error) throw new Error(`countUsers: ${error.message}`);
    return count ?? 0;
  }

  async countActiveUsers(since: number): Promise<number> {
    const { count, error } = await this.client
      .from('users')
      .select('*', { head: true, count: 'exact' })
      .gte('last_seen_at', since);
    if (error) throw new Error(`countActiveUsers: ${error.message}`);
    return count ?? 0;
  }

  async countEvents(type: ActivityEvent['type'], since?: number): Promise<number> {
    let q = this.client
      .from('events')
      .select('*', { head: true, count: 'exact' })
      .eq('type', type);
    if (since != null) q = q.gte('ts', since);
    const { count, error } = await q;
    if (error) throw new Error(`countEvents: ${error.message}`);
    return count ?? 0;
  }

  async listUsers(opts?: {
    limit?: number;
    sort?: 'lastSeen' | 'createdAt' | 'searchCount';
  }): Promise<UserRecord[]> {
    const limit = opts?.limit ?? 200;
    const sort = opts?.sort ?? 'lastSeen';
    const column = sort === 'createdAt' ? 'created_at' : sort === 'searchCount' ? 'search_count' : 'last_seen_at';
    const { data, error } = await this.client
      .from('users')
      .select('*')
      .order(column, { ascending: false })
      .limit(limit);
    if (error) throw new Error(`listUsers: ${error.message}`);
    return (data as DbUserRow[]).map(rowToUser);
  }

  async getUser(sub: string): Promise<UserRecord | null> {
    const { data, error } = await this.client
      .from('users')
      .select('*')
      .eq('sub', sub)
      .maybeSingle<DbUserRow>();
    if (error) throw new Error(`getUser: ${error.message}`);
    return data ? rowToUser(data) : null;
  }

  async listEvents(opts?: {
    limit?: number;
    type?: ActivityEvent['type'];
    sub?: string;
  }): Promise<ActivityEvent[]> {
    const limit = opts?.limit ?? 200;
    let q = this.client
      .from('events')
      .select('*')
      .order('ts', { ascending: false })
      .limit(limit);
    if (opts?.type) q = q.eq('type', opts.type);
    if (opts?.sub) q = q.eq('sub', opts.sub);
    const { data, error } = await q;
    if (error) throw new Error(`listEvents: ${error.message}`);
    return (data as DbEventRow[]).map(rowToEvent);
  }

  async topKeywords(limit = 50): Promise<{ keyword: string; count: number }[]> {
    const { data, error } = await this.client
      .from('keyword_counts')
      .select('keyword, count')
      .order('count', { ascending: false })
      .limit(limit);
    if (error) throw new Error(`topKeywords: ${error.message}`);
    return (data ?? []).map((r) => ({ keyword: r.keyword as string, count: r.count as number }));
  }

  async deleteUser(sub: string): Promise<boolean> {
    // events.sub has ON DELETE CASCADE → child rows go automatically.
    const { data, error } = await this.client
      .from('users')
      .delete()
      .eq('sub', sub)
      .select('sub');
    if (error) throw new Error(`deleteUser: ${error.message}`);
    return (data?.length ?? 0) > 0;
  }
}
