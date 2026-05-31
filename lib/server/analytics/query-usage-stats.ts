import { utcDayKey } from '@/lib/server/quota/config';
import type { UserRecord } from '@/lib/server/analytics/types';

const DAY_MS = 24 * 60 * 60 * 1000;

export type UserQueryUsageStats = {
  queriesToday: number;
  queries7d: number;
  queries30d: number;
  queriesAllTime: number;
  /** Rolling average over the last 7 calendar days (queries7d / 7). */
  avgDaily7d: number;
  /** Rolling average over the last 30 calendar days (queries30d / 30). */
  avgDaily30d: number;
};

export type GlobalQueryUsageSummary = {
  queries7d: number;
  queries30d: number;
  avgDaily7d: number;
  avgDaily30d: number;
  /** Mean queries in 7d among users with at least one query in that window. */
  avgPerActiveUser7d: number;
  avgPerActiveUser30d: number;
  usersWithQueries7d: number;
  usersWithQueries30d: number;
};

export function emptyUserQueryUsageStats(): UserQueryUsageStats {
  return {
    queriesToday: 0,
    queries7d: 0,
    queries30d: 0,
    queriesAllTime: 0,
    avgDaily7d: 0,
    avgDaily30d: 0,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function queriesTodayFromUser(user: UserRecord, day: string): number {
  if (user.queryQuotaDay === day) return Math.max(0, user.dailyQueryCount ?? 0);
  return 0;
}

export function buildUserQueryUsageStats(
  users: UserRecord[],
  queryEvents: { sub: string; ts: number }[],
  now = Date.now()
): Record<string, UserQueryUsageStats> {
  const day = utcDayKey(now);
  const since7d = now - 7 * DAY_MS;
  const since30d = now - 30 * DAY_MS;
  const out: Record<string, UserQueryUsageStats> = {};

  for (const user of users) {
    out[user.sub] = {
      ...emptyUserQueryUsageStats(),
      queriesToday: queriesTodayFromUser(user, day),
    };
  }

  for (const e of queryEvents) {
    let stats = out[e.sub];
    if (!stats) {
      stats = emptyUserQueryUsageStats();
      out[e.sub] = stats;
    }
    stats.queriesAllTime += 1;
    if (e.ts >= since30d) stats.queries30d += 1;
    if (e.ts >= since7d) stats.queries7d += 1;
  }

  for (const stats of Object.values(out)) {
    stats.avgDaily7d = round1(stats.queries7d / 7);
    stats.avgDaily30d = round1(stats.queries30d / 30);
  }

  return out;
}

export function summarizeGlobalQueryUsage(
  statsByUser: Record<string, UserQueryUsageStats>
): GlobalQueryUsageSummary {
  let queries7d = 0;
  let queries30d = 0;
  let usersWithQueries7d = 0;
  let usersWithQueries30d = 0;

  for (const stats of Object.values(statsByUser)) {
    queries7d += stats.queries7d;
    queries30d += stats.queries30d;
    if (stats.queries7d > 0) usersWithQueries7d += 1;
    if (stats.queries30d > 0) usersWithQueries30d += 1;
  }

  return {
    queries7d,
    queries30d,
    avgDaily7d: round1(queries7d / 7),
    avgDaily30d: round1(queries30d / 30),
    avgPerActiveUser7d: round1(queries7d / Math.max(1, usersWithQueries7d)),
    avgPerActiveUser30d: round1(queries30d / Math.max(1, usersWithQueries30d)),
    usersWithQueries7d,
    usersWithQueries30d,
  };
}
