import { decryptField, decryptFieldOr, encryptField } from '@/lib/server/analytics/pii-encrypt';
import { query, queryOne } from '@/lib/server/db/pool';
import { hashInviteToken, type WaitlistEntry, type WaitlistStatus, type WaitlistStore } from './types';

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

function rowToEntry(row: DbWaitlistRow): WaitlistEntry {
  return {
    id: Number(row.id),
    sub: row.sub ?? undefined,
    email: decryptFieldOr(row.email, row.email),
    name: decryptField(row.name) ?? undefined,
    picture: decryptField(row.picture) ?? undefined,
    status: row.status,
    createdAt: Number(row.created_at),
    invitedAt: row.invited_at == null ? undefined : Number(row.invited_at),
    invitedBy: row.invited_by ?? undefined,
    inviteExpiresAt: row.invite_expires_at == null ? undefined : Number(row.invite_expires_at),
    inviteTokenHash: row.invite_token_hash ?? undefined,
  };
}

export class PostgresWaitlistStore implements WaitlistStore {
  async upsertPending(input: {
    sub?: string;
    email: string;
    name?: string;
    picture?: string;
    ts: number;
  }): Promise<WaitlistEntry> {
    const existing = await this.getByEmail(input.email);
    if (existing && existing.status !== 'joined') {
      const row = await queryOne<DbWaitlistRow>(
        `update qx10_waitlist
            set sub = $2, name = $3, picture = $4
          where id = $1
        returning *`,
        [
          existing.id,
          input.sub ?? existing.sub ?? null,
          input.name ? encryptField(input.name) : null,
          input.picture ? encryptField(input.picture) : null,
        ]
      );
      if (!row) throw new Error('waitlist update failed');
      return rowToEntry(row);
    }
    if (existing?.status === 'joined') return existing;

    const row = await queryOne<DbWaitlistRow>(
      `insert into qx10_waitlist (sub, email, name, picture, status, created_at)
       values ($1, $2, $3, $4, 'pending', $5)
       returning *`,
      [
        input.sub ?? null,
        encryptField(input.email),
        input.name ? encryptField(input.name) : null,
        input.picture ? encryptField(input.picture) : null,
        input.ts,
      ]
    );
    if (!row) throw new Error('waitlist insert failed');
    return rowToEntry(row);
  }

  async list(opts?: { status?: WaitlistStatus; limit?: number }): Promise<WaitlistEntry[]> {
    const params: unknown[] = [];
    let sql = 'select * from qx10_waitlist';
    if (opts?.status) {
      params.push(opts.status);
      sql += ` where status = $${params.length}`;
    }
    sql += ' order by created_at desc';
    params.push(opts?.limit ?? 200);
    sql += ` limit $${params.length}`;
    const rows = await query<DbWaitlistRow>(sql, params);
    return rows.map(rowToEntry);
  }

  async getByEmail(email: string): Promise<WaitlistEntry | null> {
    const rows = await query<DbWaitlistRow>('select * from qx10_waitlist');
    const norm = email.trim().toLowerCase();
    const row = rows.find((entry) => decryptFieldOr(entry.email, entry.email).toLowerCase() === norm);
    return row ? rowToEntry(row) : null;
  }

  async markInvited(input: {
    id: number;
    invitedBy: string;
    tokenHash: string;
    expiresAt: number;
    ts: number;
  }): Promise<WaitlistEntry> {
    const row = await queryOne<DbWaitlistRow>(
      `update qx10_waitlist
          set status = 'invited',
              invited_at = $2,
              invited_by = $3,
              invite_token_hash = $4,
              invite_expires_at = $5
        where id = $1
      returning *`,
      [input.id, input.ts, input.invitedBy, input.tokenHash, input.expiresAt]
    );
    if (!row) throw new Error('waitlist invite failed');
    return rowToEntry(row);
  }

  async markJoined(email: string, ts: number): Promise<void> {
    void ts;
    const entry = await this.getByEmail(email);
    if (!entry) return;
    await query(`update qx10_waitlist set status = 'joined', invite_token_hash = null where id = $1`, [
      entry.id,
    ]);
  }

  async consumeInviteToken(input: {
    token: string;
    email: string;
    ts: number;
  }): Promise<{ ok: true; entry: WaitlistEntry } | { ok: false; reason: string }> {
    const hash = hashInviteToken(input.token);
    const row = await queryOne<DbWaitlistRow>(
      `select * from qx10_waitlist where status = 'invited' and invite_token_hash = $1`,
      [hash]
    );
    if (!row) return { ok: false, reason: 'invalid_token' };
    const entry = rowToEntry(row);
    if (entry.email.toLowerCase() !== input.email.trim().toLowerCase()) {
      return { ok: false, reason: 'email_mismatch' };
    }
    if (entry.inviteExpiresAt != null && input.ts > entry.inviteExpiresAt) {
      return { ok: false, reason: 'expired' };
    }
    return { ok: true, entry };
  }
}
