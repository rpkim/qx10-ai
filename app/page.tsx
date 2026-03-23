'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { GoalType } from '@/lib/types';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageSwitcher } from '@/components/language-switcher';
import { useI18n } from '@/components/i18n-provider';
import { workspaceUrl } from '@/lib/workspace-url';
import { GOAL_DESC_KEYS, GOAL_LABEL_KEYS } from '@/lib/i18n/goal-keys';
import { listRecentWorkspaces, type WorkspaceIndexEntry } from '@/lib/workspace-index';

const GOAL_IDS: GoalType[] = ['learn', 'research', 'build', 'analyze', 'strategize'];

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
  const [goal, setGoal] = useState<GoalType>('learn');
  const [focused, setFocused] = useState(false);
  const [recent, setRecent] = useState<WorkspaceIndexEntry[]>([]);

  const handleStart = () => {
    if (!keyword.trim()) return;
    router.push(workspaceUrl({ keyword: keyword.trim(), goal }));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleStart();
  };

  useEffect(() => {
    setRecent(listRecentWorkspaces(6));
  }, []);

  const featureBlocks = [
    { icon: '⟆' as const, labelKey: 'landing.feature.canvas' as const, subKey: 'landing.feature.canvasSub' as const },
    { icon: '⊕' as const, labelKey: 'landing.feature.tree' as const, subKey: 'landing.feature.treeSub' as const },
    {
      icon: '⊞' as const,
      labelKey: 'landing.feature.dashboard' as const,
      subKey: 'landing.feature.dashboardSub' as const,
    },
  ];

  const dateFmt = new Intl.DateTimeFormat(locale === 'zh' ? 'zh-Hans' : locale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <main className="relative flex h-screen w-screen flex-col items-center justify-center overflow-hidden bg-background">
      <div className="pointer-events-auto absolute right-4 top-4 z-20 flex items-center gap-2">
        <LanguageSwitcher />
        <ThemeToggle />
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

      <div className="relative z-10 flex w-full max-w-2xl flex-col items-center gap-10 px-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2">
            <QX10Logo />
            <span
              className="text-4xl font-bold tracking-tight text-foreground"
              style={{ fontFamily: 'var(--font-space-grotesk)' }}
            >
              qx<span style={{ color: '#00C49A' }}>10</span>.ai
            </span>
          </div>
          <p className="text-center text-base leading-relaxed text-muted-foreground">
            {t('landing.subLead')}
            <span className="text-foreground/70">{t('landing.subAccent')}</span>
          </p>
        </div>

        {/* Exploration mode — shapes AI answers & opening questions */}
        <div className="flex w-full flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {t('landing.explorePrompt')}
          </span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {GOAL_IDS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setGoal(id)}
                className={[
                  'flex flex-col items-center gap-0.5 rounded-xl border px-2 py-2.5 text-center text-sm transition-all duration-200',
                  goal === id
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground',
                ].join(' ')}
              >
                <span className="font-semibold leading-tight">{t(GOAL_LABEL_KEYS[id])}</span>
                <span className="text-[10px] leading-snug opacity-70">{t(GOAL_DESC_KEYS[id])}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Keyword input */}
        <div className="flex w-full flex-col gap-3">
          <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {t('landing.keywordPrompt')}
          </span>
          <div
            className={[
              'flex items-center gap-3 rounded-2xl border px-5 py-4 transition-all duration-200',
              focused
                ? 'border-primary shadow-[0_0_0_3px_rgba(0,196,154,0.12)]'
                : 'border-border bg-card',
            ].join(' ')}
            style={{ background: focused ? 'rgba(0,196,154,0.03)' : undefined }}
          >
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
              className="flex-1 bg-transparent text-base text-foreground placeholder:text-muted-foreground/50 outline-none"
            />
            <button
              onClick={handleStart}
              disabled={!keyword.trim()}
              className={[
                'flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold transition-all duration-200',
                keyword.trim()
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-[0_0_12px_rgba(0,196,154,0.4)]'
                  : 'cursor-not-allowed bg-muted text-muted-foreground',
              ].join(' ')}
            >
              {t('landing.start')}
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

          {/* Example keywords */}
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-muted-foreground/60">{t('landing.tryLabel')}</span>
            {EXAMPLE_KEYWORDS.map((ex) => (
              <button
                key={ex}
                onClick={() => setKeyword(ex)}
                className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        {/* Feature hints */}
        <div className="flex w-full gap-3">
          {featureBlocks.map((f) => (
            <div
              key={f.labelKey}
              className="flex flex-1 flex-col gap-1 rounded-xl border border-border bg-card px-4 py-3"
            >
              <span className="font-mono text-lg text-primary">{f.icon}</span>
              <span className="text-xs font-semibold text-foreground">{t(f.labelKey)}</span>
              <span className="text-xs text-muted-foreground">{t(f.subKey)}</span>
            </div>
          ))}
        </div>

        {/* Recent workspaces */}
        <div className="flex w-full flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {t('landing.recentTitle')}
          </span>
          <div className="rounded-2xl border border-border bg-card/85 p-2 backdrop-blur-sm">
            {recent.length === 0 ? (
              <div className="px-3 py-4 text-sm text-muted-foreground">{t('landing.recentEmpty')}</div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {recent.map((entry) => (
                  <button
                    key={`${entry.keyword}-${entry.updatedAt}`}
                    type="button"
                    onClick={() => router.push(workspaceUrl({ keyword: entry.keyword, goal: entry.goal }))}
                    className="flex items-center justify-between rounded-xl border border-transparent px-3 py-2 text-left transition-colors hover:border-primary/30 hover:bg-secondary/70"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-foreground">{entry.keyword}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                          {t(GOAL_LABEL_KEYS[entry.goal])}
                        </span>
                        <span>{t('landing.lastUpdated', { date: dateFmt.format(new Date(entry.updatedAt)) })}</span>
                      </div>
                    </div>
                    <span className="shrink-0 text-xs font-medium text-primary">{t('landing.continue')}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
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
