'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { GoalType } from '@/lib/types';
import { toast } from 'sonner';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageSwitcher } from '@/components/language-switcher';
import { UserMenu } from '@/components/auth/user-menu';
import { useI18n } from '@/components/i18n-provider';
import { workspaceUrl } from '@/lib/workspace-url';
import { GOAL_LABEL_KEYS } from '@/lib/i18n/goal-keys';
import { Settings } from 'lucide-react';
import {
  listRecentWorkspacesAsync,
  removeWorkspaceVisit,
  type WorkspaceIndexEntry,
} from '@/lib/workspace-index';
import { readWorkspaceLaunch } from '@/lib/workspace-launch';
import { removeDashboardGrid } from '@/lib/dashboard-layout-storage';
import { trackSearch } from '@/lib/telemetry/client';
import { Spinner } from '@/components/ui/spinner';

const EXAMPLE_KEYWORDS = [
  'Quant Trading',
  'Large Language Models',
  'Climate Change',
  'Startup Strategy',
  'Blockchain',
];

export default function LandingPage() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [keyword, setKeyword] = useState('');
  const [context, setContext] = useState('');
  const [goal, setGoal] = useState<GoalType>('learn');
  const [focused, setFocused] = useState(false);
  const [contextFocused, setContextFocused] = useState(false);
  const [recent, setRecent] = useState<WorkspaceIndexEntry[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [startAnimPhase, setStartAnimPhase] = useState(false);
  const [mounted, setMounted] = useState(false);

  const handleStart = () => {
    if (!keyword.trim() || starting) return;
    setStarting(true);
    setStartAnimPhase(false);
    window.requestAnimationFrame(() => setStartAnimPhase(true));
    const trimmed = keyword.trim();
    trackSearch({ keyword: trimmed, goal, surface: 'landing' });
    const target = workspaceUrl({ keyword: trimmed, goal, context: context.trim() || undefined });
    window.setTimeout(() => {
      router.push(target);
    }, 520);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleStart();
  };

  useEffect(() => {
    setRecentLoading(true);
    void listRecentWorkspacesAsync(6)
      .then(setRecent)
      .finally(() => setRecentLoading(false));
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const launch = readWorkspaceLaunch(new URLSearchParams(window.location.search));
    if (!launch) return;
    router.replace(workspaceUrl({ keyword: launch.keyword, goal: launch.goal }));
  }, [router]);

  const dateFmt = new Intl.DateTimeFormat(locale === 'zh' ? 'zh-Hans' : locale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const goWorkspace = (entry: WorkspaceIndexEntry) => {
    router.push(workspaceUrl({ keyword: entry.keyword, goal: entry.goal, context: entry.context }));
  };

  const goDashboardOnly = (entry: WorkspaceIndexEntry) => {
    router.push(
      workspaceUrl({
        keyword: entry.keyword,
        goal: entry.goal,
        context: entry.context,
        view: 'dashboard',
      })
    );
  };

  const deleteWorkspace = (entry: WorkspaceIndexEntry) => {
    if (!window.confirm(t('landing.deleteWorkspaceConfirm'))) return;
    void removeWorkspaceVisit(entry.keyword).then(() => {
      removeDashboardGrid(entry.keyword);
      setRecent((prev) => prev.filter((x) => x.keyword !== entry.keyword));
      toast.success(t('landing.deleteWorkspaceDone'));
    });
  };

  const recentSection = (
    <div className="flex w-full min-w-0 flex-col gap-2">
      <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        {t('landing.recentTitle')}
      </span>
      <div className="rounded-2xl border border-border bg-card/85 p-2 backdrop-blur-sm">
        {recentLoading ? (
          <div className="flex flex-col items-center gap-3 px-3 py-6">
            <Spinner className="size-6 text-primary" />
            <span className="text-sm text-muted-foreground">{t('landing.recentLoading')}</span>
            <div className="flex w-full flex-col gap-1.5 pt-1">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-muted/50" />
              ))}
            </div>
          </div>
        ) : recent.length === 0 ? (
          <div className="px-3 py-4 text-sm text-muted-foreground">{t('landing.recentEmpty')}</div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {recent.map((entry) => (
              <div
                key={`${entry.keyword}-${entry.updatedAt}`}
                className="flex flex-col gap-2 rounded-xl border border-transparent px-3 py-2 text-left transition-colors hover:border-primary/30 hover:bg-secondary/70 md:flex-row md:items-center md:justify-between"
              >
                <button
                  type="button"
                  onClick={() => goWorkspace(entry)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="truncate text-sm font-semibold text-foreground">{entry.keyword}</div>
                  {entry.context && (
                    <div className="mt-0.5 truncate text-xs text-muted-foreground/70 italic">
                      in &ldquo;{entry.context}&rdquo;
                    </div>
                  )}
                  <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                      {t(GOAL_LABEL_KEYS[entry.goal])}
                    </span>
                    <span className="min-w-0 truncate" suppressHydrationWarning>
                      {mounted
                        ? t('landing.lastUpdated', { date: dateFmt.format(new Date(entry.updatedAt)) })
                        : ''}
                    </span>
                  </div>
                </button>
                <div className="flex w-full shrink-0 items-center gap-1.5 md:ml-2 md:w-auto">
                  <button
                    type="button"
                    onClick={() => goDashboardOnly(entry)}
                    className="flex-1 rounded-lg border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary md:flex-none"
                  >
                    {t('landing.viewDashboard')}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteWorkspace(entry)}
                    className="flex-1 rounded-lg border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-destructive/50 hover:text-destructive md:flex-none"
                  >
                    {t('landing.deleteWorkspace')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <main className="fixed inset-0 flex flex-col overflow-x-hidden overflow-y-hidden bg-background md:block md:overflow-y-auto md:overscroll-y-contain [-webkit-overflow-scrolling:touch]">
      {starting && (
        <div className="pointer-events-none fixed inset-0 z-50">
          <div
            className={[
              'absolute flex items-center gap-2 transition-all duration-500 ease-in-out',
              startAnimPhase
                ? 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 scale-95 opacity-0 md:left-5 md:top-5 md:translate-x-0 md:translate-y-0 md:scale-75 md:opacity-100'
                : 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 scale-110 opacity-95',
            ].join(' ')}
          >
            <QX10Logo />
            <span
              className="text-3xl font-bold tracking-tight text-foreground"
              style={{ fontFamily: 'var(--font-space-grotesk)' }}
            >
              Qx<span style={{ color: '#00C49A' }}>10</span>.lol
            </span>
          </div>
        </div>
      )}
      <div className="pointer-events-auto absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-20 flex max-w-[calc(100%-1.5rem)] items-center gap-1 sm:right-4 sm:gap-2">
        <Link
          href="/settings"
          className="flex items-center gap-1.5 rounded-xl border border-border bg-card/90 px-2.5 py-2 text-sm font-medium text-muted-foreground backdrop-blur-sm transition-all hover:bg-secondary hover:text-foreground sm:gap-2 sm:px-3"
          title={t('landing.settings')}
        >
          <Settings className="size-4 shrink-0" />
          <span className="hidden sm:inline">{t('landing.settings')}</span>
        </Link>
        <LanguageSwitcher />
        <ThemeToggle />
        <UserMenu />
      </div>
      {/* Grid background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #00C49A 1px, transparent 1px), linear-gradient(to bottom, #00C49A 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* Glow orb */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          width: 600,
          height: 600,
          background:
            'radial-gradient(circle, rgba(0,196,154,0.06) 0%, transparent 70%)',
        }}
      />

      <div
        className={[
          'relative z-10 mx-auto flex h-full w-full min-w-0 max-w-md flex-col overflow-hidden px-4 pt-[calc(env(safe-area-inset-top)+4.25rem)] transition-all duration-300 ease-out md:h-auto md:max-w-2xl md:items-center md:gap-8 md:overflow-visible md:px-6 md:pb-10 md:pt-28',
          starting ? 'translate-y-2 opacity-0 blur-[1px]' : 'translate-y-0 opacity-100',
        ].join(' ')}
      >
        <div className="flex w-full shrink-0 flex-col gap-4 pb-3 md:gap-8 md:pb-0">
          {/* Logo */}
          <div className="flex min-w-0 flex-col gap-2 md:items-center md:gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2 md:flex-nowrap md:justify-center">
              <QX10Logo />
              <span
                className="text-3xl font-bold tracking-tight text-foreground md:text-4xl"
                style={{ fontFamily: 'var(--font-space-grotesk)' }}
                suppressHydrationWarning
              >
                Qx<span style={{ color: '#00C49A' }}>10</span>.lol
              </span>
              <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary md:text-[11px]">
                Question x10
              </span>
            </div>
            <p className="text-left text-sm leading-relaxed text-muted-foreground md:text-center md:text-base">
              {t('landing.subLead')}
              <span className="text-foreground/70">{t('landing.subAccent')}</span>
            </p>
          </div>

          {/* Keyword input */}
          <div className="flex w-full min-w-0 flex-col gap-3 rounded-2xl border border-border bg-card/80 p-3 md:rounded-none md:border-0 md:bg-transparent md:p-0">
            <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              {t('landing.keywordPrompt')}
            </span>
            <div
              className={[
                'flex min-w-0 flex-col gap-3 rounded-2xl border px-4 py-3 transition-all duration-200 md:flex-row md:items-center md:px-5 md:py-4',
                focused
                  ? 'border-primary shadow-[0_0_0_3px_rgba(0,196,154,0.12)]'
                  : 'border-border bg-card',
              ].join(' ')}
              style={{ background: focused ? 'rgba(0,196,154,0.03)' : undefined }}
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="shrink-0 text-muted-foreground"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  onKeyDown={handleKeyDown}
                  placeholder={t('landing.keywordPlaceholder')}
                  className="min-w-0 flex-1 bg-transparent text-base text-foreground placeholder:text-muted-foreground/50 outline-none"
                />
              </div>
              <button
                onClick={handleStart}
                disabled={!keyword.trim() || starting}
                className={[
                  'flex w-full shrink-0 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-200 md:w-auto md:py-2',
                  keyword.trim() && !starting
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-[0_0_12px_rgba(0,196,154,0.4)]'
                    : 'cursor-not-allowed bg-muted text-muted-foreground',
                ].join(' ')}
              >
                {starting ? 'Starting…' : t('landing.start')}
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Context input */}
            <div className="flex min-w-0 flex-col gap-1.5">
              <div className="flex items-center gap-2 px-1">
                <span className="text-xs font-semibold uppercase tracking-widest text-primary/70">
                  {t('toolbar.contextLabel')}
                </span>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary/60">
                  {t('toolbar.contextOptional')}
                </span>
              </div>
              <div
                className={[
                  'flex min-w-0 items-center gap-3 rounded-2xl border-2 px-4 py-3 transition-all duration-200 md:px-5 md:py-3.5',
                  contextFocused
                    ? 'border-primary bg-primary/5 shadow-[0_0_0_4px_rgba(0,196,154,0.1)]'
                    : context
                      ? 'border-primary/40 bg-primary/3'
                      : 'border-dashed border-primary/25 bg-primary/2 hover:border-primary/40',
                ].join(' ')}
              >
                <span
                  className={[
                    'shrink-0 rounded-lg px-2 py-0.5 text-xs font-bold transition-colors',
                    contextFocused || context
                      ? 'bg-primary/15 text-primary'
                      : 'bg-muted text-muted-foreground',
                  ].join(' ')}
                >
                  in
                </span>
                <input
                  type="text"
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  onFocus={() => setContextFocused(true)}
                  onBlur={() => setContextFocused(false)}
                  onKeyDown={handleKeyDown}
                  placeholder={t('toolbar.contextPlaceholder')}
                  className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none"
                />
                {context && (
                  <button
                    type="button"
                    onClick={() => setContext('')}
                    className="shrink-0 rounded-full p-0.5 text-muted-foreground/50 transition-colors hover:text-muted-foreground"
                    aria-label="Clear context"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Example keywords */}
            <div className="-mx-1 flex min-w-0 items-center gap-2 overflow-x-auto whitespace-nowrap px-1 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
              <span className="shrink-0 text-xs text-muted-foreground/60">{t('landing.tryLabel')}</span>
              {EXAMPLE_KEYWORDS.map((ex) => (
                <button
                  key={ex}
                  onClick={() => setKeyword(ex)}
                  className="shrink-0 rounded-full border border-border px-2.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto overscroll-y-contain pb-[max(1.5rem,env(safe-area-inset-bottom))] [-webkit-overflow-scrolling:touch] md:flex-none md:overflow-visible md:pb-0">
          {recentSection}
        </div>
      </div>
    </main>
  );
}

function QX10Logo() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
      {/* Cube frame representing 10 dimensions */}
      <rect x="2" y="6" width="16" height="16" stroke="#00C49A" strokeWidth="1.5" />
      <rect x="8" y="12" width="16" height="16" stroke="#00C49A" strokeWidth="1.5" opacity="0.6" />
      {/* Connecting lines */}
      <line x1="2" y1="6" x2="8" y2="12" stroke="#00C49A" strokeWidth="1.5" />
      <line x1="18" y1="6" x2="24" y2="12" stroke="#00C49A" strokeWidth="1.5" />
      <line x1="2" y1="22" x2="8" y2="28" stroke="#00C49A" strokeWidth="1.5" />
      <line x1="18" y1="22" x2="24" y2="28" stroke="#00C49A" strokeWidth="1.5" />
      {/* Center dot */}
      <circle cx="18" cy="18" r="2" fill="#00C49A" />
    </svg>
  );
}
