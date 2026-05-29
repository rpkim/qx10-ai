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

type Overview = {
  backend: 'supabase' | 'file' | null;
  totals: {
    users: number;
    activeUsers24h: number;
    activeUsers7d: number;
    activeUsers30d: number;
    signinsAllTime: number;
    signins24h: number;
    searchesAllTime: number;
    searches24h: number;
    consents: number;
  };
  topKeywords: { keyword: string; count: number }[];
};

type EventTypeFilter = 'all' | 'signin' | 'search' | 'consent';
type UserSort = 'lastSeen' | 'createdAt' | 'searchCount';

function fmtDate(ts?: number): string {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
}

function timeAgo(ts?: number): string {
  if (!ts) return '—';
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function AdminClient({ currentEmail }: { currentEmail: string }) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<UserRecord[]>([]);
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
      const [ovRes, usersRes, evRes] = await Promise.all([
        fetch('/api/admin/overview', { credentials: 'include' }),
        fetch(`/api/admin/users?sort=${userSort}&limit=200`, { credentials: 'include' }),
        fetch(
          `/api/admin/events?limit=200${eventType !== 'all' ? `&type=${eventType}` : ''}`,
          { credentials: 'include' }
        ),
      ]);
      if (!ovRes.ok) await explain('overview', ovRes);
      if (!usersRes.ok) await explain('users', usersRes);
      if (!evRes.ok) await explain('events', evRes);
      const ov = (await ovRes.json()) as Overview;
      const u = (await usersRes.json()) as { users: UserRecord[] };
      const ev = (await evRes.json()) as { events: ActivityEvent[] };
      setOverview(ov);
      setUsers(u.users);
      setEvents(ev.events);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load admin data');
    } finally {
      setRefreshing(false);
    }
  }, [userSort, eventType]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  const totals = overview?.totals;

  const topKeywords = useMemo(() => overview?.topKeywords ?? [], [overview]);

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
        </section>

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
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground">Users ({users.length})</h2>
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
                  <th className="px-2 py-2">First seen</th>
                  <th className="px-2 py-2">Last seen</th>
                  <th className="px-2 py-2">Consent</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.sub} className="border-t border-border align-top">
                    <td className="px-2 py-2">
                      <div className="font-medium text-foreground">{u.name || u.email}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </td>
                    <td className="px-2 py-2 tabular-nums">{u.signInCount}</td>
                    <td className="px-2 py-2 tabular-nums">{u.searchCount}</td>
                    <td className="px-2 py-2 text-xs text-muted-foreground" title={fmtDate(u.createdAt)}>
                      {timeAgo(u.createdAt)}
                    </td>
                    <td className="px-2 py-2 text-xs text-muted-foreground" title={fmtDate(u.lastSeenAt)}>
                      {timeAgo(u.lastSeenAt)}
                    </td>
                    <td className="px-2 py-2 text-xs text-muted-foreground">
                      {u.consentAt ? `${u.consentVersion ?? 'v?'} · ${timeAgo(u.consentAt)}` : '—'}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-2 py-6 text-center text-sm text-muted-foreground">
                      No users yet.
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
              {(['all', 'signin', 'search', 'consent'] as const).map((t) => (
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
                      {timeAgo(e.ts)}
                    </td>
                    <td className="px-2 py-2">
                      <span
                        className={[
                          'rounded-full px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wider',
                          e.type === 'signin'
                            ? 'bg-primary/15 text-primary'
                            : e.type === 'search'
                              ? 'bg-amber-500/15 text-amber-500'
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
        {value ?? '—'}
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
