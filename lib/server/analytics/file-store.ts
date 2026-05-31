/**
 * Local JSON-file backed analytics store. Intended for local development
 * and self-hosting. NOT suitable for serverless platforms with read-only
 * filesystems (e.g. Vercel) — use VercelKvStore there.
 */

import { promises as fs } from 'fs';
import path from 'path';
import type {
  ActivityEvent,
  AnalyticsStore,
  UserRecord,
} from './types';
import { getDefaultDailyQueryLimit, getPremiumTierDailyQueryLimit } from '@/lib/server/quota/config';
import { buildQueryQuotaSnapshot, tryConsumeDailyQueryOnUser } from '@/lib/server/quota/user-quota';
import type { ConsumeQueryResult, QueryQuotaSnapshot } from '@/lib/server/quota/types';
import type { UserTier } from '@/lib/server/quota/tiers';
import { tierForEmailOnSignIn } from '@/lib/server/quota/sync-admin-tier';
import { buildUserQueryUsageStats } from '@/lib/server/analytics/query-usage-stats';
import { decryptField, decryptFieldOr, encryptField } from './pii-encrypt';

type FileShape = {
  users: Record<string, UserRecord>;
  events: ActivityEvent[];
  keywords: Record<string, number>;
};

const MAX_EVENTS = 5000;

function encryptUserRecord(u: UserRecord): UserRecord {
  return {
    ...u,
    email: encryptField(u.email),
    name: u.name ? encryptField(u.name) : u.name,
    picture: u.picture ? encryptField(u.picture) : u.picture,
  };
}

function decryptUserRecord(u: UserRecord): UserRecord {
  return {
    ...u,
    email: decryptFieldOr(u.email, u.email),
    name: u.name ? (decryptField(u.name) ?? u.name) : u.name,
    picture: u.picture ? (decryptField(u.picture) ?? u.picture) : u.picture,
  };
}

function encryptEvent(e: ActivityEvent): ActivityEvent {
  if (e.type === 'search' || e.type === 'query') {
    return { ...e, email: encryptField(e.email), keyword: encryptField(e.keyword) };
  }
  if (e.type === 'signin') {
    return {
      ...e,
      email: encryptField(e.email),
      name: e.name ? encryptField(e.name) : e.name,
      picture: e.picture ? encryptField(e.picture) : e.picture,
    };
  }
  return { ...e, email: encryptField(e.email) };
}

function decryptEvent(e: ActivityEvent): ActivityEvent {
  if (e.type === 'search' || e.type === 'query') {
    return {
      ...e,
      email: decryptFieldOr(e.email, e.email),
      keyword: decryptFieldOr(e.keyword, e.keyword),
    };
  }
  if (e.type === 'signin') {
    return {
      ...e,
      email: decryptFieldOr(e.email, e.email),
      name: e.name ? (decryptField(e.name) ?? e.name) : e.name,
      picture: e.picture ? (decryptField(e.picture) ?? e.picture) : e.picture,
    };
  }
  return { ...e, email: decryptFieldOr(e.email, e.email) };
}

export class FileAnalyticsStore implements AnalyticsStore {
  private readonly file: string;
  private chain: Promise<unknown> = Promise.resolve();

  constructor(filePath: string) {
    this.file = filePath;
  }

  /** Serialize all state mutations through a single in-process chain. */
  private run<T>(task: () => Promise<T>): Promise<T> {
    const next = this.chain.then(task, task);
    this.chain = next.catch(() => undefined);
    return next;
  }

  private async readState(): Promise<FileShape> {
    try {
      const raw = await fs.readFile(this.file, 'utf8');
      const parsed = JSON.parse(raw) as Partial<FileShape>;
      const users: Record<string, UserRecord> = {};
      for (const [sub, u] of Object.entries(parsed.users ?? {})) {
        users[sub] = decryptUserRecord(u);
      }
      return {
        users,
        events: Array.isArray(parsed.events) ? parsed.events.map(decryptEvent) : [],
        keywords: parsed.keywords ?? {},
      };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
        return { users: {}, events: [], keywords: {} };
      }
      throw e;
    }
  }

  private async writeState(state: FileShape): Promise<void> {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    const encrypted: FileShape = {
      users: Object.fromEntries(
        Object.entries(state.users).map(([sub, u]) => [sub, encryptUserRecord(u)])
      ),
      events: state.events.map(encryptEvent),
      keywords: state.keywords,
    };
    const tmp = `${this.file}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(encrypted), 'utf8');
    await fs.rename(tmp, this.file);
  }

  upsertUserOnSignIn(input: {
    sub: string;
    email: string;
    name?: string;
    picture?: string;
    ts: number;
  }): Promise<UserRecord> {
    return this.run(async () => {
      const s = await this.readState();
      const existing = s.users[input.sub];
      const next: UserRecord = existing
        ? {
            ...existing,
            email: input.email,
            name: input.name ?? existing.name,
            picture: input.picture ?? existing.picture,
            lastSeenAt: input.ts,
            signInCount: (existing.signInCount ?? 0) + 1,
            tier: tierForEmailOnSignIn(input.email, existing.tier),
          }
        : {
            sub: input.sub,
            email: input.email,
            name: input.name,
            picture: input.picture,
            createdAt: input.ts,
            lastSeenAt: input.ts,
            signInCount: 1,
            searchCount: 0,
            tier: tierForEmailOnSignIn(input.email),
          };
      s.users[input.sub] = next;
      await this.writeState(s);
      return next;
    });
  }

  recordSearch(input: {
    sub: string;
    email: string;
    keyword: string;
    goal: string;
    surface?: string;
    ts: number;
  }): Promise<void> {
    return this.run(async () => {
      const s = await this.readState();
      const u = s.users[input.sub];
      if (u) {
        u.searchCount = (u.searchCount ?? 0) + 1;
        u.lastSeenAt = input.ts;
        s.users[input.sub] = u;
      }
      const k = input.keyword.trim().toLowerCase();
      if (k) {
        s.keywords[k] = (s.keywords[k] ?? 0) + 1;
      }
      s.events.push({
        type: 'search',
        sub: input.sub,
        email: input.email,
        keyword: input.keyword,
        goal: input.goal,
        surface: input.surface,
        ts: input.ts,
      });
      if (s.events.length > MAX_EVENTS) {
        s.events.splice(0, s.events.length - MAX_EVENTS);
      }
      await this.writeState(s);
    });
  }

  recordConsent(input: {
    sub: string;
    email: string;
    version: string;
    ts: number;
  }): Promise<void> {
    return this.run(async () => {
      const s = await this.readState();
      const u = s.users[input.sub];
      if (u) {
        u.consentAt = input.ts;
        u.consentVersion = input.version;
        s.users[input.sub] = u;
      }
      s.events.push({
        type: 'consent',
        sub: input.sub,
        email: input.email,
        version: input.version,
        ts: input.ts,
      });
      if (s.events.length > MAX_EVENTS) {
        s.events.splice(0, s.events.length - MAX_EVENTS);
      }
      await this.writeState(s);
    });
  }

  appendEvent(e: ActivityEvent): Promise<void> {
    return this.run(async () => {
      const s = await this.readState();
      s.events.push(e);
      if (s.events.length > MAX_EVENTS) {
        s.events.splice(0, s.events.length - MAX_EVENTS);
      }
      await this.writeState(s);
    });
  }

  async countUsers(): Promise<number> {
    const s = await this.readState();
    return Object.keys(s.users).length;
  }

  async countUsersCreatedSince(since: number): Promise<number> {
    const s = await this.readState();
    return Object.values(s.users).filter((u) => u.createdAt >= since).length;
  }

  async countActiveUsers(since: number): Promise<number> {
    const s = await this.readState();
    return Object.values(s.users).filter((u) => u.lastSeenAt >= since).length;
  }

  async countEvents(type: ActivityEvent['type'], since?: number): Promise<number> {
    const s = await this.readState();
    let n = 0;
    for (const e of s.events) {
      if (e.type !== type) continue;
      if (since != null && e.ts < since) continue;
      n++;
    }
    return n;
  }

  async listUsers(opts?: {
    limit?: number;
    sort?: 'lastSeen' | 'createdAt' | 'searchCount';
  }): Promise<UserRecord[]> {
    const s = await this.readState();
    const list = Object.values(s.users);
    const sort = opts?.sort ?? 'lastSeen';
    list.sort((a, b) => {
      if (sort === 'createdAt') return b.createdAt - a.createdAt;
      if (sort === 'searchCount') return (b.searchCount ?? 0) - (a.searchCount ?? 0);
      return b.lastSeenAt - a.lastSeenAt;
    });
    return list.slice(0, opts?.limit ?? 200);
  }

  async getUser(sub: string): Promise<UserRecord | null> {
    const s = await this.readState();
    return s.users[sub] ?? null;
  }

  async listEvents(opts?: {
    limit?: number;
    type?: ActivityEvent['type'];
    sub?: string;
  }): Promise<ActivityEvent[]> {
    const s = await this.readState();
    let list = s.events.slice();
    if (opts?.type) list = list.filter((e) => e.type === opts.type);
    if (opts?.sub) list = list.filter((e) => e.sub === opts.sub);
    list.sort((a, b) => b.ts - a.ts);
    return list.slice(0, opts?.limit ?? 200);
  }

  async topKeywords(limit = 50): Promise<{ keyword: string; count: number }[]> {
    const s = await this.readState();
    return Object.entries(s.keywords)
      .map(([keyword, count]) => ({ keyword, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  getQueryUsageStatsForUsers(users: UserRecord[]): Promise<Record<string, import('./query-usage-stats').UserQueryUsageStats>> {
    return this.run(async () => {
      const s = await this.readState();
      const subs = new Set(users.map((u) => u.sub));
      const events = s.events
        .filter((e) => e.type === 'query' && subs.has(e.sub))
        .map((e) => ({ sub: e.sub, ts: e.ts }));
      return buildUserQueryUsageStats(users, events);
    });
  }

  getUserQueryQuota(sub: string): Promise<QueryQuotaSnapshot | null> {
    return this.run(async () => {
      const s = await this.readState();
      const user = s.users[sub];
      if (!user) return null;
      return buildQueryQuotaSnapshot(user);
    });
  }

  tryConsumeDailyQuery(input: {
    sub: string;
    email: string;
    keyword: string;
    goal: string;
    model?: string;
    ts: number;
  }): Promise<ConsumeQueryResult> {
    return this.run(async () => {
      const s = await this.readState();
      const user = s.users[input.sub];
      if (!user) {
        return {
          ok: false,
          code: 'USER_NOT_FOUND',
          quota: {
            dailyCount: 0,
            dailyLimit: getDefaultDailyQueryLimit(),
            remaining: 0,
            resetsAt: Date.now(),
            status: 'active',
            tier: 'free',
            freeTierLimit: getDefaultDailyQueryLimit(),
            premiumTierLimit: getPremiumTierDailyQueryLimit(),
          },
        };
      }
      const { user: nextUser, result } = tryConsumeDailyQueryOnUser(user, input);
      if (!result.ok) {
        return result;
      }
      s.users[input.sub] = nextUser;
      s.events.push({
        type: 'query',
        sub: input.sub,
        email: input.email,
        keyword: input.keyword,
        goal: input.goal,
        surface: input.model,
        ts: input.ts,
      });
      if (s.events.length > MAX_EVENTS) {
        s.events.splice(0, s.events.length - MAX_EVENTS);
      }
      await this.writeState(s);
      return result;
    });
  }

  updateUserTier(sub: string, tier: UserTier): Promise<UserRecord> {
    return this.run(async () => {
      const s = await this.readState();
      const user = s.users[sub];
      if (!user) throw new Error('User not found');
      const next: UserRecord = { ...user, tier };
      s.users[sub] = next;
      await this.writeState(s);
      return next;
    });
  }

  deleteUser(sub: string): Promise<boolean> {
    return this.run(async () => {
      const s = await this.readState();
      const had = !!s.users[sub];
      delete s.users[sub];
      const before = s.events.length;
      s.events = s.events.filter((e) => e.sub !== sub);
      if (had || s.events.length !== before) {
        await this.writeState(s);
      }
      return had;
    });
  }
}
