'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { WorkspaceProvider, useWorkspace } from '@/lib/workspace-store';
import type { GoalType } from '@/lib/types';
import { getSuggestedQueries } from '@/lib/mock-data';
import { Canvas } from '@/components/workspace/canvas';
import { Toolbar } from '@/components/workspace/toolbar';
import { MiniMap } from '@/components/workspace/minimap';
import { DashboardPanel } from '@/components/workspace/dashboard-panel';
import { registerWorkspaceVisit } from '@/lib/workspace-index';
import { useI18n } from '@/components/i18n-provider';
import { loadWorkspaceFromLocalStorage } from '@/lib/workspace-snapshot';

function WorkspacePageFallback() {
  const { t } = useI18n();
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div
          className="h-10 w-10 rounded-full border-2"
          style={{ borderColor: '#00C49A', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }}
        />
        <span className="text-sm text-muted-foreground">{t('workspace.loading')}</span>
      </div>
    </div>
  );
}

export default function WorkspacePage() {
  return (
    <Suspense fallback={<WorkspacePageFallback />}>
      <WorkspaceSessionGate />
    </Suspense>
  );
}

/** New `ws` query = new React session so canvas state does not mix across keywords. */
function WorkspaceSessionGate() {
  const searchParams = useSearchParams();
  const ws = searchParams.get('ws') ?? 'default';
  return (
    <WorkspaceProvider key={ws}>
      <WorkspaceInner />
    </WorkspaceProvider>
  );
}

function WorkspaceInner() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { initWorkspace, state, dispatch } = useWorkspace();
  const [showDashboard, setShowDashboard] = useState(false);
  const [dashboardExpanded, setDashboardExpanded] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const keyword = searchParams.get('keyword');
    const goal = (searchParams.get('goal') as GoalType) || 'learn';
    if (keyword) {
      const saved = loadWorkspaceFromLocalStorage(keyword);
      if (saved.ok) {
        dispatch({ type: 'LOAD_SNAPSHOT', snapshot: saved.state });
      } else {
        initWorkspace(keyword, goal);
      }
      setReady(true);
    } else {
      router.replace('/');
    }
    // Intentionally once per provider mount; `ws` key remounts when starting a new workspace.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready || !state.keyword) return;
    registerWorkspaceVisit(state.keyword, state.goal);
  }, [ready, state.keyword, state.goal]);

  useEffect(() => {
    if (!ready || !state.keyword) return;

    const root = state.nodes.find((n) => n.type === 'root');
    if (!root) return;

    const hasRootQueries = state.edges.some((e) => {
      if (e.sourceId !== root.id) return false;
      const t = state.nodes.find((n) => n.id === e.targetId);
      return t?.type === 'query';
    });
    if (hasRootQueries) return;

    let cancelled = false;
    fetch('/api/workspace/seed-queries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword: state.keyword, goal: state.goal }),
    })
      .then((r) => r.json())
      .then((data: { questions?: string[] }) => {
        if (cancelled) return;
        const qs = Array.isArray(data.questions)
          ? data.questions.map((q) => String(q).trim()).filter(Boolean)
          : [];
        dispatch({
          type: 'SET_SEED_QUERIES',
          questions: qs.length > 0 ? qs : getSuggestedQueries(state.keyword),
        });
      })
      .catch(() => {
        if (!cancelled) {
          dispatch({
            type: 'SET_SEED_QUERIES',
            questions: getSuggestedQueries(state.keyword),
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [ready, state.keyword, state.goal, dispatch]);

  if (!ready || !state.keyword) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div
            className="h-10 w-10 rounded-full border-2"
            style={{ borderColor: '#00C49A', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }}
          />
          <span className="text-sm text-muted-foreground">{t('workspace.initializing')}</span>
        </div>
      </div>
    );
  }

  const canvasObscured = showDashboard && dashboardExpanded;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-background">
      <Toolbar
        onToggleDashboard={() => {
          setShowDashboard((v) => {
            if (v) setDashboardExpanded(false);
            return !v;
          });
        }}
        showDashboard={showDashboard}
      />

      <div
        className="absolute inset-0"
        style={{
          right: showDashboard && !dashboardExpanded ? '480px' : 0,
          opacity: canvasObscured ? 0 : 1,
          pointerEvents: canvasObscured ? 'none' : 'auto',
          transition: 'right 0.3s ease, opacity 0.25s ease',
        }}
      >
        <Canvas />
      </div>

      {!canvasObscured && <MiniMap />}

      {showDashboard && (
        <DashboardPanel
          onClose={() => {
            setShowDashboard(false);
            setDashboardExpanded(false);
          }}
          expanded={dashboardExpanded}
          onExpandedChange={setDashboardExpanded}
        />
      )}

      <div
        className={`absolute bottom-4 left-4 z-10 flex flex-col gap-1.5 rounded-xl border border-border bg-card/90 px-3 py-3 backdrop-blur-sm transition-opacity ${canvasObscured ? 'pointer-events-none opacity-0' : ''}`}
        aria-label={t('workspace.legendTitle')}
      >
        <span className="mb-0.5 text-xs font-medium text-muted-foreground">{t('workspace.legendTitle')}</span>
        {[
          { color: '#00C49A', labelKey: 'workspace.legendRoot' as const },
          { color: '#60A5FA', labelKey: 'workspace.legendQuery' as const },
          { color: '#A3E635', labelKey: 'workspace.legendAnswer' as const },
          { color: '#F59E0B', labelKey: 'workspace.legendData' as const },
        ].map(({ color, labelKey }) => (
          <div key={labelKey} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: color }} />
            <span className="text-xs text-muted-foreground">{t(labelKey)}</span>
          </div>
        ))}
        <div className="mt-1.5 flex items-center gap-2 border-t border-border pt-1.5">
          <span className="text-xs text-muted-foreground/60">{t('workspace.legendHint')}</span>
        </div>
      </div>
    </div>
  );
}
