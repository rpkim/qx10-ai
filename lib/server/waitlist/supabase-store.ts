import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  getSupabaseSecretKey,
  getSupabaseUrl,
  isSupabaseServerConfigured,
} from '@/lib/supabase/config';
import type { WaitlistEntry, WaitlistStatus, WaitlistStore } from './types';
import { hashInviteToken } from './types';
import { decryptField, decryptFieldOr, encryptField } from '@/lib/server/analytics/pii-encrypt';

type DbWaitlistRow = {
  id: number;
  sub: string | null;
  email: string;
  name: string | null;
  picture: string | null;
  status: WaitlistStatus;
  created_at: number;
  invited_at: number | null;
  invited_by: string | null;
  invite_token_hash: string | null;
  invite_expires_at: number | null;
};

function rowToEntry(r: DbWaitlistRow): WaitlistEntry {
  return {
    id: r.id,
    sub: r.sub ?? undefined,
    email: decryptFieldOr(r.email, r.email),
    name: decryptField(r.name) ?? undefined,
    picture: decryptField(r.picture) ?? undefined,
    status: r.status,
    createdAt: Number(r.created_at),
    invitedAt: r.invited_at == null ? undefined : Number(r.invited_at),
    invitedBy: r.invited_by ?? undefined,
    inviteExpiresAt: r.invite_expires_at == null ? undefined : Number(r.invite_expires_at),
    inviteTokenHash: r.invite_token_hash ?? undefined,
  };
}

export class SupabaseWaitlistStore implements WaitlistStore {
  private client: SupabaseClient;

  constructor() {
    this.client = createClient(getSupabaseUrl()!, getSupabaseSecretKey()!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async upsertPending(input: {
    sub?: string;
    email: string;
    name?: string;
    picture?: string;
    ts: number;
  }): Promise<WaitlistEntry> {
    const existing = await this.getByEmail(input.email);
    if (existing && existing.status !== 'joined') {
      const { data, error } = await this.client
        .from('waitlist')
        .update({
          sub: input.sub ?? existing.sub ?? null,
          name: input.name ? encryptField(input.name) : null,
          picture: input.picture ? encryptField(input.picture) : null,
        })
        .eq('id', existing.id)
        .select('*')
        .single<DbWaitlistRow>();
      if (error || !data) throw new Error(`waitlist update: ${error?.message}`);
      return rowToEntry(data);
    }
    if (existing?.status === 'joined') return existing;

    const { data, error } = await this.client
      .from('waitlist')
      .insert({
        sub: input.sub ?? null,
        email: encryptField(input.email),
        name: input.name ? encryptField(input.name) : null,
        picture: input.picture ? encryptField(input.picture) : null,
        status: 'pending',
        created_at: input.ts,
      })
      .select('*')
      .single<DbWaitlistRow>();
    if (error || !data) throw new Error(`waitlist insert: ${error?.message}`);
    return rowToEntry(data);
  }

  async list(opts?: { status?: WaitlistStatus; limit?: number }): Promise<WaitlistEntry[]> {
    let q = this.client.from('waitlist').select('*').order('created_at', { ascending: false });
    if (opts?.status) q = q.eq('status', opts.status);
    q = q.limit(opts?.limit ?? 200);
    const { data, error } = await q;
    if (error) throw new Error(`waitlist list: ${error.message}`);
    return (data as DbWaitlistRow[]).map(rowToEntry);
  }

  async getByEmail(email: string): Promise<WaitlistEntry | null> {
    const { data, error } = await this.client.from('waitlist').select('*');
    if (error) throw new Error(`waitlist get: ${error.message}`);
    const norm = email.trim().toLowerCase();
    const row = (data as DbWaitlistRow[] | null)?.find(
      (r) => decryptFieldOr(r.email, r.email).toLowerCase() === norm
    );
    return row ? rowToEntry(row) : null;
  }

  async markInvited(input: {
    id: number;
    invitedBy: string;
    tokenHash: string;
    expiresAt: number;
    ts: number;
  }): Promise<WaitlistEntry> {
    const { data, error } = await this.client
      .from('waitlist')
      .update({
        status: 'invited',
        invited_at: input.ts,
        invited_by: input.invitedBy,
        invite_token_hash: input.tokenHash,
        invite_expires_at: input.expiresAt,
      })
      .eq('id', input.id)
      .select('*')
      .single<DbWaitlistRow>();
    if (error || !data) throw new Error(`waitlist invite: ${error?.message}`);
    return rowToEntry(data);
  }

  async markJoined(email: string, ts: number): Promise<void> {
    void ts;
    const entry = await this.getByEmail(email);
    if (!entry) return;
    const { error } = await this.client
      .from('waitlist')
      .update({ status: 'joined', invite_token_hash: null })
      .eq('id', entry.id);
    if (error) throw new Error(`waitlist joined: ${error.message}`);
  }

  async consumeInviteToken(input: {
    token: string;
    email: string;
    ts: number;
  }): Promise<{ ok: true; entry: WaitlistEntry } | { ok: false; reason: string }> {
    const hash = hashInviteToken(input.token);
    const { data, error } = await this.client
      .from('waitlist')
      .select('*')
      .eq('status', 'invited')
      .eq('invite_token_hash', hash)
      .maybeSingle<DbWaitlistRow>();
    if (error) return { ok: false, reason: 'store_error' };
    if (!data) return { ok: false, reason: 'invalid_token' };
    const entry = rowToEntry(data);
    if (entry.email.toLowerCase() !== input.email.trim().toLowerCase()) {
      return { ok: false, reason: 'email_mismatch' };
    }
    if (entry.inviteExpiresAt != null && input.ts > entry.inviteExpiresAt) {
      return { ok: false, reason: 'expired' };
    }
    return { ok: true, entry };
  }
}

export function isWaitlistDbConfigured(): boolean {
  return isSupabaseServerConfigured();
}
