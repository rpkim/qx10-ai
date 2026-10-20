import { query, queryOne } from '@/lib/server/db/pool';
import { buildUserQueryUsageStats } from '@/lib/server/analytics/query-usage-stats';
import { decryptField, decryptFieldOr, encryptField } from '@/lib/server/analytics/pii-encrypt';
import type { ActivityEvent, AnalyticsStore, UserRecord } from '@/lib/server/analytics/types';
import { getDefaultDailyQueryLimit, getPremiumTierDailyQueryLimit } from '@/lib/server/quota/config';
import { tierForEmailOnSignIn } from '@/lib/server/quota/sync-admin-tier';
import { parseUserTier, type UserTier } from '@/lib/server/quota/tiers';
import type { ConsumeQueryResult, QueryQuotaSnapshot } from '@/lib/server/quota/types';
import { buildQueryQuotaSnapshot, tryConsumeDailyQueryOnUser } from '@/lib/server/quota/user-quota';

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
  daily_query_count: number | null;
  query_quota_day: string | null;
  daily_query_limit: number | null;
  tier: string | null;
  status: string | null;
};

type DbEventRow = {
  id: number;
  type: 'signin' | 'search' | 'consent' | 'query';
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

const USER_SORT = {
  lastSeen: 'last_seen_at',
  createdAt: 'created_at',
  searchCount: 'search_count',
} as const;

function rowToUser(r: DbUserRow): UserRecord {
  return {
    sub: r.sub,
    email: decryptFieldOr(r.email, r.email),
    name: decryptField(r.name) ?? undefined,
    picture: decryptField(r.picture) ?? undefined,
    createdAt: Number(r.created_at),
    lastSeenAt: Number(r.last_seen_at),
    signInCount: r.sign_in_count,
    searchCount: r.search_count,
    consentAt: r.consent_at == null ? undefined : Number(r.consent_at),
    consentVersion: r.consent_version ?? undefined,
    dailyQueryCount: r.daily_query_count ?? 0,
    queryQuotaDay: r.query_quota_day ?? undefined,
    dailyQueryLimit: r.daily_query_limit,
    tier: parseUserTier(r.tier),
    status: r.status === 'suspended' ? 'suspended' : 'active',
  };
}

function rowToEvent(r: DbEventRow): ActivityEvent {
  if (r.type === 'search' || r.type === 'query') {
    return {
      type: r.type,
      sub: r.sub,
      email: decryptFieldOr(r.email, r.email),
      ts: Number(r.ts),
      keyword: decryptFieldOr(r.keyword, ''),
      goal: r.goal ?? '',
      surface: r.surface ?? undefined,
    };
  }
  if (r.type === 'consent') {
    return {
      type: 'consent',
      sub: r.sub,
      email: decryptFieldOr(r.email, r.email),
      ts: Number(r.ts),
      version: r.consent_version ?? 'v?',
    };
  }
  return {
    type: 'signin',
    sub: r.sub,
    email: decryptFieldOr(r.email, r.email),
    ts: Number(r.ts),
    name: decryptField(r.name) ?? undefined,
    picture: decryptField(r.picture) ?? undefined,
  };
}

function emptyQuota(dailyLimit = getDefaultDailyQueryLimit()): QueryQuotaSnapshot {
  return {
    dailyCount: 0,
    dailyLimit,
    remaining: 0,
    resetsAt: Date.now(),
    status: 'active',
    tier: 'free',
    freeTierLimit: getDefaultDailyQueryLimit(),
    premiumTierLimit: getPremiumTierDailyQueryLimit(),
  };
}

export class PostgresAnalyticsStore implements AnalyticsStore {
  async upsertUserOnSignIn(input: {
    sub: string;
    email: string;
    name?: string;
    picture?: string;
    ts: number;
  }): Promise<UserRecord> {
    const existing = await queryOne<DbUserRow>('select * from qx10_users where sub = $1', [input.sub]);
    const encEmail = encryptField(input.email);
    const encName = input.name ? encryptField(input.name) : null;
    const encPicture = input.picture ? encryptField(input.picture) : null;
    const tier = tierForEmailOnSignIn(input.email, existing ? parseUserTier(existing.tier) : undefined);

    const upserted = existing
      ? await queryOne<DbUserRow>(
          `update qx10_users
              set email = $2,
                  name = coalesce($3, name),
                  picture = coalesce($4, picture),
                  last_seen_at = $5,
                  sign_in_count = sign_in_count + 1,
                  tier = $6
            where sub = $1
          returning *`,
          [input.sub, encEmail, encName, encPicture, input.ts, tier]
        )
      : await queryOne<DbUserRow>(
          `insert into qx10_users
             (sub, email, name, picture, created_at, last_seen_at, sign_in_count, search_count, tier)
           values ($1, $2, $3, $4, $5, $5, 1, 0, $6)
           returning *`,
          [input.sub, encEmail, encName, encPicture, input.ts, tier]
        );
    if (!upserted) throw new Error('upsertUser write failed');

    try {
      await query(
        `insert into qx10_events (type, sub, email, ts, name, picture)
         values ('signin', $1, $2, $3, $4, $5)`,
        [input.sub, encEmail, input.ts, encName, encPicture]
      );
    } catch (error) {
      console.error('[postgres] signin event insert failed', error);
    }
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
    await query(
      `select qx10_fn_record_search($1, $2, $3, $4, $5, $6, $7)`,
      [
        input.sub,
        encryptField(input.email),
        encryptField(keyword),
        keyword.toLowerCase(),
        input.goal,
        input.surface ?? null,
        input.ts,
      ]
    );
  }

  async recordConsent(input: {
    sub: string;
    email: string;
    version: string;
    ts: number;
  }): Promise<void> {
    try {
      await query(
        `update qx10_users set consent_at = $2, consent_version = $3 where sub = $1`,
        [input.sub, input.ts, input.version]
      );
    } catch (error) {
      console.error('[postgres] consent update failed', error);
    }
    await query(
      `insert into qx10_events (type, sub, email, ts, consent_version)
       values ('consent', $1, $2, $3, $4)`,
      [input.sub, encryptField(input.email), input.ts, input.version]
    );
  }

  async appendEvent(e: ActivityEvent): Promise<void> {
    const row = {
      keyword: null as string | null,
      goal: null as string | null,
      surface: null as string | null,
      consent_version: null as string | null,
      name: null as string | null,
      picture: null as string | null,
    };
    if (e.type === 'search' || e.type === 'query') {
      row.keyword = encryptField(e.keyword);
      row.goal = e.goal;
      row.surface = e.surface ?? null;
    } else if (e.type === 'consent') {
      row.consent_version = e.version;
    } else if (e.type === 'signin') {
      row.name = e.name ? encryptField(e.name) : null;
      row.picture = e.picture ? encryptField(e.picture) : null;
    }
    await query(
      `insert into qx10_events
         (type, sub, email, ts, keyword, goal, surface, consent_version, name, picture)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        e.type,
        e.sub,
        encryptField(e.email),
        e.ts,
        row.keyword,
        row.goal,
        row.surface,
        row.consent_version,
        row.name,
        row.picture,
      ]
    );
  }

  async countUsers(): Promise<number> {
    const row = await queryOne<{ count: number }>('select count(*)::int as count from qx10_users');
    return row?.count ?? 0;
  }

  async countUsersCreatedSince(since: number): Promise<number> {
    const row = await queryOne<{ count: number }>(
      'select count(*)::int as count from qx10_users where created_at >= $1',
      [since]
    );
    return row?.count ?? 0;
  }

  async countActiveUsers(since: number): Promise<number> {
    const row = await queryOne<{ count: number }>(
      'select count(*)::int as count from qx10_users where last_seen_at >= $1',
      [since]
    );
    return row?.count ?? 0;
  }

  async countEvents(type: ActivityEvent['type'], since?: number): Promise<number> {
    const row =
      since == null
        ? await queryOne<{ count: number }>(
            'select count(*)::int as count from qx10_events where type = $1',
            [type]
          )
        : await queryOne<{ count: number }>(
            'select count(*)::int as count from qx10_events where type = $1 and ts >= $2',
            [type, since]
          );
    return row?.count ?? 0;
  }

  async listUsers(opts?: {
    limit?: number;
    sort?: 'lastSeen' | 'createdAt' | 'searchCount';
  }): Promise<UserRecord[]> {
    const limit = opts?.limit ?? 200;
    const column = USER_SORT[opts?.sort ?? 'lastSeen'];
    const rows = await query<DbUserRow>(
      `select * from qx10_users order by ${column} desc limit $1`,
      [limit]
    );
    return rows.map(rowToUser);
  }

  async getUser(sub: string): Promise<UserRecord | null> {
    const row = await queryOne<DbUserRow>('select * from qx10_users where sub = $1', [sub]);
    return row ? rowToUser(row) : null;
  }

  async listEvents(opts?: {
    limit?: number;
    type?: ActivityEvent['type'];
    sub?: string;
  }): Promise<ActivityEvent[]> {
    const params: unknown[] = [];
    const where: string[] = [];
    if (opts?.type) {
      params.push(opts.type);
      where.push(`type = $${params.length}`);
    }
    if (opts?.sub) {
      params.push(opts.sub);
      where.push(`sub = $${params.length}`);
    }
    params.push(opts?.limit ?? 200);
    const sql = `select * from qx10_events ${where.length ? `where ${where.join(' and ')}` : ''} order by ts desc limit $${params.length}`;
    const rows = await query<DbEventRow>(sql, params);
    return rows.map(rowToEvent);
  }

  async topKeywords(limit = 50): Promise<{ keyword: string; count: number }[]> {
    const rows = await query<{ keyword: string; count: number }>(
      'select keyword, count from qx10_keyword_counts order by count desc limit $1',
      [limit]
    );
    return rows.map((row) => ({ keyword: row.keyword, count: Number(row.count) }));
  }

  async getQueryUsageStatsForUsers(
    users: UserRecord[]
  ): Promise<Record<string, import('./query-usage-stats').UserQueryUsageStats>> {
    if (users.length === 0) return {};
    const rows = await query<{ sub: string; ts: number }>(
      `select sub, ts from qx10_events where type = 'query' and sub = any($1::text[])`,
      [users.map((user) => user.sub)]
    );
    return buildUserQueryUsageStats(
      users,
      rows.map((row) => ({ sub: row.sub, ts: Number(row.ts) }))
    );
  }

  async getUserQueryQuota(sub: string): Promise<QueryQuotaSnapshot | null> {
    const user = await this.getUser(sub);
    if (!user) return null;
    return buildQueryQuotaSnapshot(user);
  }

  async tryConsumeDailyQuery(input: {
    sub: string;
    email: string;
    keyword: string;
    goal: string;
    model?: string;
    ts: number;
  }): Promise<ConsumeQueryResult> {
    const row = await queryOne<{ qx10_fn_try_consume_daily_query: ConsumeRpc }>(
      `select qx10_fn_try_consume_daily_query($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        input.sub,
        encryptField(input.email),
        encryptField(input.keyword),
        input.goal,
        input.model ?? null,
        input.ts,
        getDefaultDailyQueryLimit(),
        getPremiumTierDailyQueryLimit(),
      ]
    );
    const data = row?.qx10_fn_try_consume_daily_query;
    if (data && typeof data === 'object') {
      const user = await this.getUser(input.sub);
      const quota = user != null ? buildQueryQuotaSnapshot(user, input.ts) : emptyQuota(data.daily_limit);
      if (data.allowed) return { ok: true, quota };
      const code =
        data.code === 'SUSPENDED'
          ? 'SUSPENDED'
          : data.code === 'USER_NOT_FOUND'
            ? 'USER_NOT_FOUND'
            : 'DAILY_QUOTA_EXCEEDED';
      return { ok: false, code, quota };
    }

    const user = await this.getUser(input.sub);
    if (!user) return { ok: false, code: 'USER_NOT_FOUND', quota: emptyQuota() };
    const { user: nextUser, result } = tryConsumeDailyQueryOnUser(user, input);
    if (!result.ok) return result;
    await query(
      `update qx10_users
          set daily_query_count = $2, query_quota_day = $3, last_seen_at = $4
        where sub = $1`,
      [input.sub, nextUser.dailyQueryCount, nextUser.queryQuotaDay, nextUser.lastSeenAt]
    );
    await this.appendEvent({
      type: 'query',
      sub: input.sub,
      email: input.email,
      keyword: input.keyword,
      goal: input.goal,
      surface: input.model,
      ts: input.ts,
    });
    return result;
  }

  async updateUserTier(sub: string, tier: UserTier): Promise<UserRecord> {
    const row = await queryOne<DbUserRow>(
      'update qx10_users set tier = $2 where sub = $1 returning *',
      [sub, tier]
    );
    if (!row) throw new Error('User not found');
    return rowToUser(row);
  }

  async deleteUser(sub: string): Promise<boolean> {
    const rows = await query<{ sub: string }>('delete from qx10_users where sub = $1 returning sub', [sub]);
    return rows.length > 0;
  }
}

type ConsumeRpc = {
  allowed?: boolean;
  code?: string;
  daily_count?: number;
  daily_limit?: number;
};
