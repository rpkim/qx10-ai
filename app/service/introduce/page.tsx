'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, CircleHelp } from 'lucide-react';
import { WorkspaceProvider, useWorkspace } from '@/lib/workspace-store';
import { Canvas } from '@/components/workspace/canvas';
import { MiniMap } from '@/components/workspace/minimap';
import { MobileWorkspaceShell } from '@/components/workspace/mobile-workspace-shell';
import { LanguageSwitcher } from '@/components/language-switcher';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/components/i18n-provider';
import { parseWorkspaceSnapshot } from '@/lib/workspace-snapshot';
import { buildDemoResponsesFromSnapshot } from '@/lib/introduce-demo-responses';
import { IntroduceRevealProvider } from '@/lib/introduce-reveal-context';
import rawSnapshot from '@/lib/demo/service-intro-llm-snapshot.en.json';
import { applyIntroLocalePatch } from '@/lib/demo/apply-intro-locale-patch';
import { getIntroLocalePatch } from '@/lib/demo/intro-locale-patches';
import { syncIntroAnswerSuggestedQueriesWithChildQueries } from '@/lib/demo/sync-intro-answer-suggestions';
import { focusQueryNodeOnCanvas } from '@/lib/workspace-focus-query-node';
import type { QueryNodeData, WorkspaceState } from '@/lib/types';

const ROOT_SEED_PREFIX = 'qx10.root.seed.v1:';

function rootSeedQuestionsFromSnapshot(state: WorkspaceState): string[] {
  const qs = state.nodes
    .filter((n): n is QueryNodeData => n.type === 'query' && n.parentId === 'root')
    .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x)
    .map((q) => q.question.trim())
    .filter(Boolean);
  return qs.length > 0 ? qs : [state.keyword];
}

export default function ServiceIntroducePage() {
  const { t, locale } = useI18n();
  const { state, demoResponses, parsedOk } = useMemo(() => {
    const patched = applyIntroLocalePatch(rawSnapshot, getIntroLocalePatch(locale));
    const parsed = parseWorkspaceSnapshot(patched as unknown);
    if (!parsed.ok) {
      return { state: null as WorkspaceState | null, demoResponses: {}, parsedOk: false as const };
    }
    const synced = syncIntroAnswerSuggestedQueriesWithChildQueries(parsed.state);
    return {
      state: synced,
      demoResponses: buildDemoResponsesFromSnapshot(synced),
      parsedOk: true as const,
    };
  }, [locale]);

  if (!parsedOk || !state) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 text-sm text-muted-foreground">
        {t('introduce.demoLoadError')}
      </div>
    );
  }
  return (
    <WorkspaceProvider key={locale} demoResponses={demoResponses}>
      <IntroduceRevealProvider key={locale} baselineSnapshot={state}>
        <IntroduceChrome initialState={state} />
      </IntroduceRevealProvider>
    </WorkspaceProvider>
  );
}

function IntroduceChrome({ initialState }: { initialState: WorkspaceState }) {
  const { t } = useI18n();
  const { dispatch, state } = useWorkspace();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [desktopViewMode, setDesktopViewMode] = useState<'canvas' | 'cards'>('cards');
  const useCardMode = desktopViewMode === 'cards';
  /** Start as `cards` so switching to canvas always counts as a transition (snapshot coords are often off-screen). */
  const prevDesktopModeRef = useRef<'canvas' | 'cards'>('cards');

  useEffect(() => {
    try {
      const key = `${ROOT_SEED_PREFIX}${initialState.keyword}::${initialState.goal}`;
      window.localStorage.setItem(
        key,
        JSON.stringify({ questions: rootSeedQuestionsFromSnapshot(initialState), status: 'ai' })
      );
    } catch {
      // ignore
    }
    dispatch({ type: 'LOAD_SNAPSHOT', snapshot: initialState });
    setReady(true);
  }, [dispatch, initialState]);

  useEffect(() => {
    if (!ready) return;
    if (desktopViewMode !== 'canvas') {
      prevDesktopModeRef.current = desktopViewMode;
      return;
    }
    const prev = prevDesktopModeRef.current;
    if (prev !== 'canvas') {
      const root = state.nodes.find((n) => n.type === 'root');
      if (root) focusQueryNodeOnCanvas(root, state.viewport.zoom, dispatch);
    }
    prevDesktopModeRef.current = desktopViewMode;
  }, [ready, desktopViewMode, state.nodes, state.viewport.zoom, dispatch]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F9FA] dark:bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <main className="relative flex min-h-screen flex-col bg-[#F8F9FA] text-foreground dark:bg-background">
      {/* subtle grid + sparkles */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.06] dark:opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #64748b 1px, transparent 1px), linear-gradient(to bottom, #64748b 1px, transparent 1px)',
          backgroundSize: '56px 56px',
        }}
      />
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.35]"
        style={{
          backgroundImage: `radial-gradient(circle at 12% 18%, rgba(0,196,154,0.12) 0, transparent 42%),
            radial-gradient(circle at 88% 12%, rgba(59,130,246,0.1) 0, transparent 40%)`,
        }}
      />

      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-background/85 px-4 py-3 backdrop-blur-md dark:border-border dark:bg-background/90 sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <Link
            href="/"
            className="flex min-w-0 items-center gap-2 transition-opacity hover:opacity-90"
          >
            <Qx10Mark />
            <span
              className="truncate text-lg font-bold tracking-tight text-slate-900 dark:text-foreground"
              style={{ fontFamily: 'var(--font-space-grotesk)' }}
            >
              Qx<span style={{ color: '#00C49A' }}>10</span>
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <Link
              href="/"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card/90 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              title={t('introduce.home')}
              aria-label={t('introduce.home')}
            >
              <CircleHelp className="size-4" />
            </Link>
            <LanguageSwitcher />
            <ThemeToggle />
            <Button
              type="button"
              className="h-9 gap-1 rounded-xl bg-[#2563EB] px-6 text-sm font-semibold text-white shadow-sm hover:bg-[#1D4ED8]"
              onClick={() => router.push('/')}
            >
              {t('introduce.cta')}
              <ChevronRight className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
      </header>

      <section className="relative z-10 px-4 pb-6 pt-10 text-center sm:px-8 sm:pb-8 sm:pt-4">
        <h1
          className="mx-auto max-w-4xl text-balance text-3xl font-extrabold leading-tight tracking-tight text-slate-900 dark:text-foreground sm:text-4xl md:text-5xl"
          style={{ fontFamily: 'var(--font-space-grotesk)' }}
        >
          {t('introduce.headline1')}
          <br className="sm:hidden" />
          <span className="sm:ml-2">{t('introduce.headline2')}</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-pretty text-sm text-slate-600 dark:text-muted-foreground sm:text-base">
          {t('introduce.subtitle')}
        </p>
      </section>

      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col gap-3 px-4 pb-12 sm:px-8">
        <p className="mx-auto max-w-2xl text-pretty text-center text-sm leading-relaxed text-slate-600 dark:text-muted-foreground sm:text-[15px]">
          {t('introduce.demoWorkspaceHint')}
        </p>
        <div className="flex justify-center">
          <div className="inline-flex items-center rounded-xl border border-slate-200/90 bg-card/90 p-1 shadow-sm dark:border-border">
            <button
              type="button"
              onClick={() => setDesktopViewMode('canvas')}
              className={[
                'rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors',
                desktopViewMode === 'canvas'
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              {t('introduce.viewCanvas')}
            </button>
            <button
              type="button"
              onClick={() => setDesktopViewMode('cards')}
              className={[
                'rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors',
                desktopViewMode === 'cards'
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              {t('introduce.viewCards')}
            </button>
          </div>
        </div>
        <div className="mx-auto flex w-full flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-card shadow-[0_24px_60px_-12px_rgba(15,23,42,0.12)] dark:border-border dark:shadow-none">
          <div className="relative min-h-[min(72vh,680px)] min-w-0 flex-1">
            {useCardMode ? (
              <MobileWorkspaceShell showDashboard={false} isMobile={false} embedded />
            ) : (
              <div className="absolute inset-0">
                <Canvas />
                <MiniMap />
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function Qx10Mark() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden>
      <rect x="2" y="6" width="16" height="16" stroke="#00C49A" strokeWidth="1.5" />
      <rect x="8" y="12" width="16" height="16" stroke="#00C49A" strokeWidth="1.5" opacity="0.6" />
      <line x1="2" y1="6" x2="8" y2="12" stroke="#00C49A" strokeWidth="1.5" />
      <line x1="18" y1="6" x2="24" y2="12" stroke="#00C49A" strokeWidth="1.5" />
      <line x1="2" y1="22" x2="8" y2="28" stroke="#00C49A" strokeWidth="1.5" />
      <line x1="18" y1="22" x2="24" y2="28" stroke="#00C49A" strokeWidth="1.5" />
      <circle cx="18" cy="18" r="2" fill="#00C49A" />
    </svg>
  );
}
