'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Database,
  HardDrive,
  RefreshCw,
  Search,
  ShieldCheck,
  Users as UsersIcon,
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { UserMenu } from '@/components/auth/user-menu';
import type { ActivityEvent, UserRecord } from '@/lib/server/analytics/types';
import { isElevatedTier, parseUserTier, type UserTier } from '@/lib/quota/tiers';

type UserQueryUsageStats = {
  queriesToday: number;
  queries7d: number;
  queries30d: number;
  queriesAllTime: number;
  avgDaily7d: number;
  avgDaily30d: number;
};

type WaitlistRow = {
  id: number;
  email: string;
  name?: string;
  status: 'pending' | 'invited' | 'joined';
  createdAt: number;
  invitedAt?: number;
};

type Overview = {
  backend: 'supabase' | 'file' | null;
  freeTierDailyLimit?: number;
  premiumTierDailyLimit?: number;
  signupStats?: {
    signupsToday: number;
    maxPerDay: number;
    remaining: number;
    waitlistPending: number;
    waitlistInvited: number;
  };
  queryUsage?: {
    queries7d: number;
    queries30d: number;
    avgDaily7d: number;
    avgDaily30d: number;
    avgPerActiveUser7d: number;
    avgPerActiveUser30d: number;
    usersWithQueries7d: number;
    usersWithQueries30d: number;
  };
  totals: {
    users: number;
    activeUsers24h: number;
    activeUsers7d: number;
    activeUsers30d: number;
    signinsAllTime: number;
    signins24h: number;
    searchesAllTime: number;
    searches24h: number;
    queriesAllTime?: number;
    queries24h?: number;
    queries7d?: number;
    queries30d?: number;
    consents: number;
  };
  topKeywords: { keyword: string; count: number }[];
};

type EventTypeFilter = 'all' | 'signin' | 'search' | 'consent' | 'query';
type UserSort = 'lastSeen' | 'createdAt' | 'searchCount';

function fmtDate(ts?: number): string {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
}

function timeAgo(ts?: number, live = true): string {
  if (!ts) return '—';
  if (!live) return '…';
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function utcDayKey(ts = Date.now()): string {
  return new Date(ts).toISOString().slice(0, 10);
}

function userQueryUsageToday(
  u: UserRecord,
  freeLimit: number,
  premiumLimit: number
): { count: number; limit: number; tier: UserTier } {
  const day = utcDayKey();
  const count = u.queryQuotaDay === day ? (u.dailyQueryCount ?? 0) : 0;
  const tier = parseUserTier(u.tier);
  const limit = isElevatedTier(tier) ? premiumLimit : freeLimit;
  return { count, limit, tier };
}

export function AdminClient({ currentEmail }: { currentEmail: string }) {
  const [mounted, setMounted] = useState(false);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [queryStats, setQueryStats] = useState<Record<string, UserQueryUsageStats>>({});
  const [waitlist, setWaitlist] = useState<WaitlistRow[]>([]);
  const [invitingId, setInvitingId] = useState<number | null>(null);
  const [userSort, setUserSort] = useState<UserSort>('lastSeen');
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [eventType, setEventType] = useState<EventTypeFilter>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    setError(null);

    const explain = async (label: string, res: Response): Promise<never> => {
      let detail = `HTTP ${res.status}`;
      try {
        const j = (await res.json()) as { message?: string; hint?: string; backend?: string };
        if (j.message) detail = j.message;
        if (j.hint) detail += ` — ${j.hint}`;
        if (j.backend) detail += ` (backend: ${j.backend})`;
      } catch {
        /* non-JSON body */
      }
      throw new Error(`${label}: ${detail}`);
    };

    try {
      const [ovRes, usersRes, evRes, wlRes] = await Promise.all([
        fetch('/api/admin/overview', { credentials: 'include' }),
        fetch(`/api/admin/users?sort=${userSort}&limit=200`, { credentials: 'include' }),
        fetch(
          `/api/admin/events?limit=200${eventType !== 'all' ? `&type=${eventType}` : ''}`,
          { credentials: 'include' }
        ),
        fetch('/api/admin/waitlist', { credentials: 'include' }),
      ]);
      if (!ovRes.ok) await explain('overview', ovRes);
      if (!usersRes.ok) await explain('users', usersRes);
      if (!evRes.ok) await explain('events', evRes);
      if (!wlRes.ok) await explain('waitlist', wlRes);
      const ov = (await ovRes.json()) as Overview;
      const u = (await usersRes.json()) as {
        users: UserRecord[];
        queryStats?: Record<string, UserQueryUsageStats>;
      };
      const ev = (await evRes.json()) as { events: ActivityEvent[] };
      const wl = (await wlRes.json()) as { entries: WaitlistRow[] };
      setOverview(ov);
      setUsers(u.users);
      setQueryStats(u.queryStats ?? {});
      setEvents(ev.events);
      setWaitlist(wl.entries ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load admin data');
    } finally {
      setRefreshing(false);
    }
  }, [userSort, eventType]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  const totals = overview?.totals;
  const queryUsage = overview?.queryUsage;
  const signupStats = overview?.signupStats;
  const freeTierLimit = overview?.freeTierDailyLimit ?? 80;
  const premiumTierLimit = overview?.premiumTierDailyLimit ?? 200;

  const topKeywords = useMemo(() => overview?.topKeywords ?? [], [overview]);
  const liveTimes = mounted;

  const inviteWaitlist = async (id: number) => {
    setInvitingId(id);
    try {
      const res = await fetch(`/api/admin/waitlist/${id}/invite`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      await refreshAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invite failed');
    } finally {
      setInvitingId(null);
    }
  };

  return (
    <main className="fixed inset-0 overflow-y-auto overscroll-y-contain bg-background [-webkit-overflow-scrolling:touch]">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 pb-[max(6rem,env(safe-area-inset-bottom))]">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              Home
            </Link>
            <span className="text-muted-foreground">/</span>
            <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-foreground">
              <ShieldCheck className="size-5 text-primary" />
              Admin Console
            </h1>
            {overview?.backend && (
              <span
                className="ml-2 inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[11px] uppercase tracking-wider text-muted-foreground"
                title={
                  overview.backend === 'supabase'
                    ? 'Supabase (Postgres) — production-grade'
                    : 'Local JSON file — development only'
                }
              >
                {overview.backend === 'supabase' ? (
                  <Database className="size-3" />
                ) : (
                  <HardDrive className="size-3" />
                )}
                {overview.backend}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void refreshAll()}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-60"
            >
              <RefreshCw className={['size-4', refreshing ? 'animate-spin' : ''].join(' ')} />
              Refresh
            </button>
            <ThemeToggle />
            <UserMenu />
          </div>
        </header>

        <div className="text-xs text-muted-foreground">
          Signed in as <span className="font-medium text-foreground">{currentEmail}</span>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total users" value={totals?.users} icon={<UsersIcon className="size-4" />} />
          <StatCard label="Active 24h" value={totals?.activeUsers24h} accent />
          <StatCard label="Active 7d" value={totals?.activeUsers7d} />
          <StatCard label="Active 30d" value={totals?.activeUsers30d} />
          <StatCard label="Sign-ins (all)" value={totals?.signinsAllTime} />
          <StatCard label="Sign-ins 24h" value={totals?.signins24h} />
          <StatCard
            label="Searches (all)"
            value={totals?.searchesAllTime}
            icon={<Search className="size-4" />}
          />
          <StatCard label="Searches 24h" value={totals?.searches24h} accent />
          <StatCard label="AI queries (all)" value={totals?.queriesAllTime} />
          <StatCard label="AI queries 24h" value={totals?.queries24h} accent />
          <StatCard label="AI queries 7d" value={totals?.queries7d ?? queryUsage?.queries7d} />
          <StatCard label="AI queries 30d" value={totals?.queries30d ?? queryUsage?.queries30d} accent />
          <StatCard label="Avg queries/day (7d)" value={queryUsage?.avgDaily7d} />
          <StatCard label="Avg queries/user (7d)" value={queryUsage?.avgPerActiveUser7d} accent />
          <StatCard label="Signups today" value={signupStats?.signupsToday} />
          <StatCard
            label="Signup cap (today)"
            value={signupStats ? signupStats.maxPerDay : undefined}
          />
          <StatCard label="Waitlist pending" value={signupStats?.waitlistPending} accent />
        </section>

        <p className="text-xs text-muted-foreground">
          Daily AI limits by tier — Free:{' '}
          <span className="font-semibold text-foreground">{freeTierLimit}</span> (
          <code className="rounded bg-muted px-1">DAILY_QUERY_LIMIT</code>) · Premium / Admin:{' '}
          <span className="font-semibold text-foreground">{premiumTierLimit}</span> (
          <code className="rounded bg-muted px-1">PREMIUM_DAILY_QUERY_LIMIT</code>). Change tier per
          user below.
        </p>

        <section className="rounded-2xl border border-border bg-card/80 p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Top searched keywords</h2>
            <span className="text-xs text-muted-foreground">{topKeywords.length} unique</span>
          </div>
          {topKeywords.length === 0 ? (
            <div className="text-xs text-muted-foreground">No searches recorded yet.</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {topKeywords.map((k) => (
                <span
                  key={k.keyword}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-xs"
                >
                  <span className="font-medium text-foreground">{k.keyword}</span>
                  <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                    {k.count}
                  </span>
                </span>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card/80 p-5 shadow-sm">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                User management
                <span className="ml-1.5 font-normal text-muted-foreground">({users.length})</span>
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Set each user&apos;s tier (Free / Premium / Admin). App admins (
                <code className="rounded bg-muted px-1">ADMIN_EMAILS</code>) are auto-assigned Admin
                tier on sign-in.
              </p>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <SortChip current={userSort} value="lastSeen" onClick={setUserSort}>
                Recently active
              </SortChip>
              <SortChip current={userSort} value="createdAt" onClick={setUserSort}>
                Newest
              </SortChip>
              <SortChip current={userSort} value="searchCount" onClick={setUserSort}>
                Top searchers
              </SortChip>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-2 py-2">User</th>
                  <th className="px-2 py-2">Sign-ins</th>
                  <th className="px-2 py-2">Searches</th>
                  <th className="px-2 py-2">Queries today</th>
                  <th className="px-2 py-2">Query usage</th>
                  <th className="px-2 py-2">Tier</th>
                  <th className="px-2 py-2">First seen</th>
                  <th className="px-2 py-2">Last seen</th>
                  <th className="px-2 py-2">Consent</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const usage = userQueryUsageToday(u, freeTierLimit, premiumTierLimit);
                  const stats = queryStats[u.sub];
                  return (
                  <tr key={u.sub} className={[
                    'border-t border-border align-top',
                    u.email.toLowerCase() === currentEmail.toLowerCase() ? 'bg-primary/5' : '',
                  ].join(' ')}>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-2">
                        <div>
                          <div className="font-medium text-foreground">{u.name || u.email}</div>
                          <div className="text-xs text-muted-foreground">{u.email}</div>
                        </div>
                        {u.email.toLowerCase() === currentEmail.toLowerCase() ? (
                          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                            You
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-2 py-2 tabular-nums">{u.signInCount}</td>
                    <td className="px-2 py-2 tabular-nums">{u.searchCount}</td>
                    <td className="px-2 py-2 tabular-nums">
                      <span className={usage.count >= usage.limit ? 'font-semibold text-amber-500' : ''}>
                        {usage.count}
                      </span>
                      <span className="text-muted-foreground"> / {usage.limit}</span>
                    </td>
                    <td className="px-2 py-2 text-xs leading-relaxed text-muted-foreground">
                      {stats ? (
                        <div className="space-y-0.5 tabular-nums">
                          <div>
                            <span className="text-foreground">{stats.queries7d}</span> in 7d
                            <span className="text-muted-foreground/80"> · avg {stats.avgDaily7d}/day</span>
                          </div>
                          <div>
                            <span className="text-foreground">{stats.queries30d}</span> in 30d
                            <span className="text-muted-foreground/80"> · avg {stats.avgDaily30d}/day</span>
                          </div>
                          <div className="text-muted-foreground/70">{stats.queriesAllTime} all-time</div>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <UserTierEditor
                        sub={u.sub}
                        current={usage.tier}
                        freeLimit={freeTierLimit}
                        premiumLimit={premiumTierLimit}
                        onSaved={() => void refreshAll()}
                      />
                    </td>
                    <td className="px-2 py-2 text-xs text-muted-foreground" title={fmtDate(u.createdAt)}>
                      {timeAgo(u.createdAt, liveTimes)}
                    </td>
                    <td className="px-2 py-2 text-xs text-muted-foreground" title={fmtDate(u.lastSeenAt)}>
                      {timeAgo(u.lastSeenAt, liveTimes)}
                    </td>
                    <td className="px-2 py-2 text-xs text-muted-foreground">
                      {u.consentAt ? `${u.consentVersion ?? 'v?'} · ${timeAgo(u.consentAt, liveTimes)}` : '—'}
                    </td>
                  </tr>
                  );
                })}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-2 py-6 text-center text-sm text-muted-foreground">
                      No users yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card/80 p-5 shadow-sm">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-foreground">
              Waitlist ({waitlist.filter((w) => w.status !== 'joined').length})
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Daily signup cap: {signupStats?.signupsToday ?? '—'} / {signupStats?.maxPerDay ?? '—'} today.
              Invite sends a Resend email with a sign-in link (bypasses the daily cap).
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-2 py-2">Email</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Added</th>
                  <th className="px-2 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {waitlist
                  .filter((w) => w.status !== 'joined')
                  .map((w) => (
                    <tr key={w.id} className="border-t border-border align-top">
                      <td className="px-2 py-2">
                        <div className="font-medium text-foreground">{w.name || w.email}</div>
                        <div className="text-xs text-muted-foreground">{w.email}</div>
                      </td>
                      <td className="px-2 py-2 text-xs capitalize">{w.status}</td>
                      <td className="px-2 py-2 text-xs text-muted-foreground" title={fmtDate(w.createdAt)}>
                        {timeAgo(w.createdAt, liveTimes)}
                      </td>
                      <td className="px-2 py-2">
                        {w.status === 'pending' ? (
                          <button
                            type="button"
                            disabled={invitingId === w.id}
                            onClick={() => void inviteWaitlist(w.id)}
                            className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
                          >
                            {invitingId === w.id ? 'Sending…' : 'Invite'}
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground">Invited</span>
                        )}
                      </td>
                    </tr>
                  ))}
                {waitlist.filter((w) => w.status !== 'joined').length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-2 py-6 text-center text-sm text-muted-foreground">
                      No one on the waitlist.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card/80 p-5 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground">Recent events ({events.length})</h2>
            <div className="flex items-center gap-1 text-xs">
              {(['all', 'signin', 'search', 'query', 'consent'] as const).map((t) => (
                <SortChip key={t} current={eventType} value={t} onClick={setEventType}>
                  {t === 'all' ? 'All' : t}
                </SortChip>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-2 py-2">Time</th>
                  <th className="px-2 py-2">Type</th>
                  <th className="px-2 py-2">User</th>
                  <th className="px-2 py-2">Detail</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e, i) => (
                  <tr key={`${e.ts}-${i}`} className="border-t border-border align-top">
                    <td
                      className="px-2 py-2 text-xs text-muted-foreground"
                      title={fmtDate(e.ts)}
                    >
                      {timeAgo(e.ts, liveTimes)}
                    </td>
                    <td className="px-2 py-2">
                      <span
                        className={[
                          'rounded-full px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wider',
                          e.type === 'signin'
                            ? 'bg-primary/15 text-primary'
                            : e.type === 'search'
                              ? 'bg-amber-500/15 text-amber-500'
                              : e.type === 'query'
                                ? 'bg-sky-500/15 text-sky-500'
                                : 'bg-secondary text-muted-foreground',
                        ].join(' ')}
                      >
                        {e.type}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-xs text-muted-foreground">{e.email}</td>
                    <td className="px-2 py-2 text-xs">
                      {e.type === 'search'
                        ? `${e.keyword} · ${e.goal}${e.surface ? ` · ${e.surface}` : ''}`
                        : e.type === 'query'
                          ? `${e.keyword} · ${e.goal}${e.surface ? ` · ${e.surface}` : ''}`
                          : e.type === 'consent'
                          ? `consent ${e.version}`
                          : e.type === 'signin'
                            ? e.name ?? '—'
                            : '—'}
                    </td>
                  </tr>
                ))}
                {events.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-2 py-6 text-center text-sm text-muted-foreground">
                      No events yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {overview?.backend === 'file' && (
          <p className="rounded-xl border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-xs leading-relaxed text-amber-600 dark:text-amber-400">
            Using a local JSON file as the analytics store. This works for local
            development and self-hosting, but on serverless platforms (Vercel etc.)
            the filesystem is ephemeral. Apply{' '}
            <code>db/schema.sql</code> in your Supabase project and set{' '}
            <code>NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
            <code>SUPABASE_SECRET_KEY</code> (or legacy{' '}
            <code>SUPABASE_SERVICE_ROLE_KEY</code>){' '}
            to switch to durable Postgres storage.
          </p>
        )}
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number | undefined;
  icon?: React.ReactNode;
  accent?: boolean;
}) {
  const display =
    value == null ? '—' : Number.isInteger(value) ? String(value) : value.toFixed(1);
  return (
    <div className="rounded-2xl border border-border bg-card/80 p-4 shadow-sm">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <div
        className={[
          'mt-1 text-2xl font-semibold tabular-nums',
          accent ? 'text-primary' : 'text-foreground',
        ].join(' ')}
      >
        {display}
      </div>
    </div>
  );
}

function SortChip<T extends string>({
  current,
  value,
  onClick,
  children,
}: {
  current: T;
  value: T;
  onClick: (v: T) => void;
  children: React.ReactNode;
}) {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      className={[
        'rounded-full border px-2.5 py-1 transition-colors',
        active
          ? 'border-primary/40 bg-primary/10 text-primary'
          : 'border-border bg-transparent text-muted-foreground hover:border-primary/30 hover:text-foreground',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function tierBadgeClass(tier: UserTier): string {
  switch (tier) {
    case 'admin':
      return 'border-violet-500/40 bg-violet-500/10 text-violet-600 dark:text-violet-400';
    case 'premium':
      return 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400';
    default:
      return 'border-border bg-muted/40 text-muted-foreground';
  }
}

function UserTierEditor({
  sub,
  current,
  freeLimit,
  premiumLimit,
  onSaved,
}: {
  sub: string;
  current: UserTier;
  freeLimit: number;
  premiumLimit: number;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onChange = async (tier: UserTier) => {
    if (tier === current) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(sub)}/tier`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span
        className={[
          'inline-flex w-fit rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
          tierBadgeClass(current),
        ].join(' ')}
      >
        {current}
      </span>
      <select
        value={current}
        disabled={saving}
        onChange={(e) => void onChange(e.target.value as UserTier)}
        className="rounded border border-border bg-background px-1.5 py-0.5 text-xs"
        aria-label="User tier"
      >
        <option value="free">Free ({freeLimit}/day)</option>
        <option value="premium">Premium ({premiumLimit}/day)</option>
        <option value="admin">Admin ({premiumLimit}/day)</option>
      </select>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  );
}
