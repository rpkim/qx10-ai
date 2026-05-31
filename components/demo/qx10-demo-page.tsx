'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { WorkspaceProvider, useWorkspace, type DemoResponse } from '@/lib/workspace-store';
import { Canvas } from '@/components/workspace/canvas';
import { MiniMap } from '@/components/workspace/minimap';
import { MobileWorkspaceShell } from '@/components/workspace/mobile-workspace-shell';
import { LanguageSwitcher } from '@/components/language-switcher';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/components/i18n-provider';
import { GOAL_LABEL_KEYS } from '@/lib/i18n/goal-keys';
import { DemoSetupPanel, type DemoSetupValues } from '@/components/demo/demo-setup-panel';
import {
  clearDemoWorkspaceTourSession,
  DemoCanvasTourProvider,
  DemoDashboardTourProvider,
  DemoFollowUpTourProvider,
  DemoWorkspaceTourProvider,
  useDemoCanvasTourOptional,
  useDemoDashboardTourOptional,
} from '@/components/demo/demo-workspace-tour';
import { parseWorkspaceSnapshot } from '@/lib/workspace-snapshot';
import { buildDemoResponsesFromSnapshot } from '@/lib/introduce-demo-responses';
import { IntroduceRevealProvider } from '@/lib/introduce-reveal-context';
import rawSnapshot from '@/lib/demo/service-intro-llm-snapshot.en.json';
import { applyIntroLocalePatch } from '@/lib/demo/apply-intro-locale-patch';
import { getIntroLocalePatch } from '@/lib/demo/intro-locale-patches';
import { syncIntroAnswerSuggestedQueriesWithChildQueries } from '@/lib/demo/sync-intro-answer-suggestions';
import { focusQueryNodeOnCanvas } from '@/lib/workspace-focus-query-node';
import type { GoalType, QueryNodeData, WorkspaceState } from '@/lib/types';

const ROOT_SEED_PREFIX = 'qx10.root.seed.v1:';

function rootSeedQuestionsFromSnapshot(state: WorkspaceState): string[] {
  const qs = state.nodes
    .filter((n): n is QueryNodeData => n.type === 'query' && n.parentId === 'root')
    .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x)
    .map((q) => q.question.trim())
    .filter(Boolean);
  return qs.length > 0 ? qs : [state.keyword];
}

export function Qx10DemoPage() {
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

  const sample: DemoSetupValues = {
    keyword: state.keyword,
    context: state.context ?? '',
    goal: state.goal,
  };

  return (
    <DemoPageShell sample={sample} initialState={state} demoResponses={demoResponses} locale={locale} />
  );
}

function DemoPageShell({
  sample,
  initialState,
  demoResponses,
  locale,
}: {
  sample: DemoSetupValues;
  initialState: WorkspaceState;
  demoResponses: Record<string, DemoResponse>;
  locale: string;
}) {
  const [phase, setPhase] = useState<'setup' | 'workspace'>('setup');
  const [setupValues, setSetupValues] = useState<DemoSetupValues | null>(null);

  const handleStart = (values: DemoSetupValues) => {
    clearDemoWorkspaceTourSession();
    setSetupValues(values);
    setPhase('workspace');
  };

  if (phase === 'setup') {
    return <DemoSetupChrome sample={sample} onStart={handleStart} />;
  }

  return (
    <WorkspaceProvider key={locale} demoResponses={demoResponses}>
      <IntroduceRevealProvider key={locale} baselineSnapshot={initialState}>
        <DemoChrome
          initialState={initialState}
          setupValues={setupValues ?? sample}
          onBackToSetup={() => {
            try {
              window.sessionStorage.removeItem('qx10.demo.setupTour.dismissed');
              clearDemoWorkspaceTourSession();
            } catch {
              // ignore
            }
            setPhase('setup');
          }}
        />
      </IntroduceRevealProvider>
    </WorkspaceProvider>
  );
}

function DemoSetupChrome({
  sample,
  onStart,
}: {
  sample: DemoSetupValues;
  onStart: (values: DemoSetupValues) => void;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();

  return (
    <main className="relative flex min-h-screen flex-col bg-[#F8F9FA] text-foreground dark:bg-background">
      <DemoPageBackground />
      <DemoHeader onCta={() => router.push('/')} />

      <section className="relative z-10 px-4 pb-1 pt-6 text-center sm:px-8 sm:pb-2 sm:pt-4">
        <h1
          className="mx-auto max-w-4xl text-balance text-2xl font-extrabold leading-tight tracking-tight text-slate-900 dark:text-foreground sm:text-4xl md:text-5xl"
          style={{ fontFamily: 'var(--font-space-grotesk)' }}
        >
          {t('introduce.headline1')}
          <br className="sm:hidden" />
          <span className="sm:ml-2">{t('introduce.headline2')}</span>
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-pretty text-sm text-slate-600 dark:text-muted-foreground sm:mt-4 sm:text-base">
          {t('introduce.subtitle')}
        </p>
      </section>

      <div className="relative z-10">
        <DemoSetupPanel key={locale} sample={sample} onStart={onStart} />
      </div>
    </main>
  );
}

function DemoChrome({
  initialState,
  setupValues,
  onBackToSetup,
}: {
  initialState: WorkspaceState;
  setupValues: DemoSetupValues;
  onBackToSetup: () => void;
}) {
  const { t } = useI18n();
  const { dispatch, state } = useWorkspace();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [desktopViewMode, setDesktopViewMode] = useState<'canvas' | 'cards'>('cards');
  const [showDashboard, setShowDashboard] = useState(false);
  const [canvasTourDone, setCanvasTourDone] = useState(false);
  const useCardMode = desktopViewMode === 'cards';
  const prevDesktopModeRef = useRef<'canvas' | 'cards'>('cards');
  const canvasButtonRef = useRef<HTMLButtonElement>(null);
  const dashboardButtonRef = useRef<HTMLButtonElement>(null);
  const pinnedDataCount = state.dashboardNodeIds.filter((id) =>
    state.nodes.some((n) => n.id === id && n.type === 'data')
  ).length;

  useEffect(() => {
    try {
      const ctx = initialState.context ?? '';
      const key = `${ROOT_SEED_PREFIX}${initialState.keyword}::${ctx}::${initialState.goal}`;
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
    if (typeof window === 'undefined') return;
    if (window.sessionStorage.getItem('qx10.demo.canvasTour.dismissed') === '1') {
      setCanvasTourDone(true);
    }
  }, []);

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
      <DemoPageBackground />
      <DemoHeader onCta={() => router.push('/')} />

      <div className="relative z-10 mx-auto w-full max-w-xl px-4 pb-2 pt-6 sm:max-w-2xl sm:px-8">
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card/90 p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1 text-left">
              <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                {t('landing.keywordPrompt')}
              </span>
              <p
                className="text-lg font-semibold text-foreground"
                style={{ fontFamily: 'var(--font-space-grotesk)' }}
              >
                {setupValues.keyword}
              </p>
              <span
                className="w-fit rounded-full px-2 py-0.5 text-xs font-semibold"
                style={{ background: 'rgba(0,196,154,0.15)', color: '#00C49A' }}
              >
                {t(GOAL_LABEL_KEYS[setupValues.goal as GoalType])}
              </span>
            </div>
            <button
              type="button"
              onClick={onBackToSetup}
              className="shrink-0 rounded-lg border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
            >
              {t('introduce.demoBackSetup')}
            </button>
          </div>

          {setupValues.context ? (
            <div className="flex min-w-0 flex-col gap-1.5 border-t border-border/60 pt-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-widest text-primary/70">
                  {t('toolbar.contextLabel')}
                </span>
              </div>
              <div className="flex min-w-0 items-center gap-3 rounded-2xl border-2 border-primary/40 bg-primary/5 px-4 py-3">
                <span className="shrink-0 rounded-lg bg-primary/15 px-2 py-0.5 text-xs font-bold text-primary">
                  in
                </span>
                <span className="min-w-0 flex-1 text-left text-sm font-medium text-foreground">
                  {setupValues.context}
                </span>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col gap-3 px-4 pb-12 sm:px-8">
        <DemoCanvasTourProvider
          canvasButtonRef={canvasButtonRef}
          cardsMode={useCardMode}
          onDismissed={() => setCanvasTourDone(true)}
        >
          <DemoDashboardTourProvider
            dashboardButtonRef={dashboardButtonRef}
            canvasTourDone={canvasTourDone}
          >
            <DemoViewModeToggle
              desktopViewMode={desktopViewMode}
              showDashboard={showDashboard}
              pinnedDataCount={pinnedDataCount}
              canvasButtonRef={canvasButtonRef}
              dashboardButtonRef={dashboardButtonRef}
              onCanvas={() => {
                setShowDashboard(false);
                setDesktopViewMode('canvas');
              }}
              onCards={() => {
                setShowDashboard(false);
                setDesktopViewMode('cards');
              }}
              onDashboard={() => {
                setShowDashboard(true);
                setDesktopViewMode('cards');
              }}
            />
          </DemoDashboardTourProvider>
        </DemoCanvasTourProvider>
        <div className="mx-auto flex w-full flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-card shadow-[0_24px_60px_-12px_rgba(15,23,42,0.12)] dark:border-border dark:shadow-none">
          <div className="relative min-h-[min(72vh,680px)] min-w-0 flex-1">
            <DemoWorkspaceTourProvider>
              <DemoFollowUpTourProvider>
                {useCardMode ? (
                  <MobileWorkspaceShell
                    showDashboard={showDashboard}
                    isMobile={false}
                    embedded
                  />
                ) : (
                  <div className="absolute inset-0">
                    <Canvas />
                    <MiniMap />
                  </div>
                )}
              </DemoFollowUpTourProvider>
            </DemoWorkspaceTourProvider>
          </div>
        </div>
      </div>
    </main>
  );
}

function DemoViewModeToggle({
  desktopViewMode,
  showDashboard,
  pinnedDataCount,
  canvasButtonRef,
  dashboardButtonRef,
  onCanvas,
  onCards,
  onDashboard,
}: {
  desktopViewMode: 'canvas' | 'cards';
  showDashboard: boolean;
  pinnedDataCount: number;
  canvasButtonRef: React.RefObject<HTMLButtonElement | null>;
  dashboardButtonRef: React.RefObject<HTMLButtonElement | null>;
  onCanvas: () => void;
  onCards: () => void;
  onDashboard: () => void;
}) {
  const { t } = useI18n();
  const canvasTour = useDemoCanvasTourOptional();
  const dashboardTour = useDemoDashboardTourOptional();

  return (
    <div className="flex justify-center">
      <div className="inline-flex max-w-full flex-wrap items-center justify-center gap-1 rounded-xl border border-slate-200/90 bg-card/90 p-1 shadow-sm dark:border-border">
        <button
          ref={canvasButtonRef}
          type="button"
          onClick={() => {
            canvasTour?.dismiss();
            onCanvas();
          }}
          className={[
            'rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-200 sm:px-4',
            desktopViewMode === 'canvas'
              ? 'bg-primary/15 text-primary'
              : canvasTour?.canvasGlow
                ? 'demo-run-glow relative z-[102] bg-primary/10 text-primary ring-2 ring-primary/70 ring-offset-2 ring-offset-background'
                : 'text-muted-foreground hover:text-foreground',
          ].join(' ')}
        >
          {t('introduce.viewCanvas')}
        </button>
        <button
          type="button"
          onClick={onCards}
          className={[
            'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors sm:px-4',
            desktopViewMode === 'cards' && !showDashboard
              ? 'bg-primary/15 text-primary'
              : 'text-muted-foreground hover:text-foreground',
          ].join(' ')}
        >
          {t('introduce.viewCards')}
        </button>
        <button
          ref={dashboardButtonRef}
          type="button"
          onClick={() => {
            dashboardTour?.dismiss();
            onDashboard();
          }}
          className={[
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-200 sm:px-4',
            showDashboard
              ? 'bg-primary/15 text-primary'
              : dashboardTour?.dashboardGlow
                ? 'demo-run-glow relative z-[102] bg-primary/10 text-primary ring-2 ring-primary/70 ring-offset-2 ring-offset-background'
                : pinnedDataCount > 0
                  ? 'text-muted-foreground hover:text-foreground'
                  : 'cursor-not-allowed text-muted-foreground/50',
          ].join(' ')}
          disabled={pinnedDataCount === 0 && !dashboardTour?.dashboardGlow}
        >
          {t('toolbar.dashboard')}
          {pinnedDataCount > 0 ? (
            <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-primary">
              {pinnedDataCount}
            </span>
          ) : null}
        </button>
      </div>
    </div>
  );
}

function DemoPageBackground() {
  return (
    <>
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
    </>
  );
}

function DemoHeader({ onCta }: { onCta: () => void }) {
  const { t } = useI18n();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-background/85 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] backdrop-blur-md dark:border-border dark:bg-background/90 sm:px-8">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <Link href="/" className="flex min-w-0 items-center gap-2 transition-opacity hover:opacity-90">
          <Qx10Mark />
          <span
            className="truncate text-lg font-bold tracking-tight text-slate-900 dark:text-foreground"
            style={{ fontFamily: 'var(--font-space-grotesk)' }}
          >
            Qx<span style={{ color: '#00C49A' }}>10</span>
          </span>
        </Link>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
          <Button
            type="button"
            className="h-9 gap-1 rounded-xl bg-[#2563EB] px-6 text-sm font-semibold text-white shadow-sm hover:bg-[#1D4ED8]"
            onClick={onCta}
          >
            {t('introduce.cta')}
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        </div>
      </div>
    </header>
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
