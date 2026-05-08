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

type FileShape = {
  users: Record<string, UserRecord>;
  events: ActivityEvent[];
  keywords: Record<string, number>;
};

const MAX_EVENTS = 5000;

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
      return {
        users: parsed.users ?? {},
        events: Array.isArray(parsed.events) ? parsed.events : [],
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
    const tmp = `${this.file}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(state), 'utf8');
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
