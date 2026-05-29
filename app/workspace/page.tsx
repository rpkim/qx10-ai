'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { WorkspaceProvider, useWorkspace } from '@/lib/workspace-store';
import type { GoalType } from '@/lib/types';
import { Canvas } from '@/components/workspace/canvas';
import { Toolbar } from '@/components/workspace/toolbar';
import { MiniMap } from '@/components/workspace/minimap';
import { DashboardPanel } from '@/components/workspace/dashboard-panel';
import { MobileWorkspaceShell } from '@/components/workspace/mobile-workspace-shell';
import { registerWorkspaceVisit } from '@/lib/workspace-index';
import { useI18n } from '@/components/i18n-provider';
import { loadWorkspaceFromLocalStorage } from '@/lib/workspace-snapshot';
import { readWorkspaceLaunch } from '@/lib/workspace-launch';
import { focusQueryNodeOnCanvas } from '@/lib/workspace-focus-query-node';

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
  const [desktopViewMode, setDesktopViewMode] = useState<'canvas' | 'cards'>('cards');
  const [ready, setReady] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const initialView = searchParams.get('view');
  const prevDesktopViewRef = useRef<'canvas' | 'cards' | null>(null);

  useEffect(() => {
    const apply = () => setIsMobile(window.innerWidth < 768);
    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = window.localStorage.getItem('qx10.desktop.viewMode');
    if (saved === 'cards' || saved === 'canvas') {
      setDesktopViewMode(saved);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('qx10.desktop.viewMode', desktopViewMode);
  }, [desktopViewMode]);

  useEffect(() => {
    const launch = readWorkspaceLaunch(searchParams);
    if (launch) {
      const saved = loadWorkspaceFromLocalStorage(launch.keyword);
      if (saved.ok) {
        dispatch({ type: 'LOAD_SNAPSHOT', snapshot: saved.state });
      } else {
        initWorkspace(launch.keyword, launch.goal, launch.context);
      }
      if (initialView === 'dashboard') {
        setShowDashboard(true);
        setDashboardExpanded(true);
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

  /**
   * Canvas가 처음 보이거나(Cards→Canvas, 또는 저장된 설정이 Canvas인 첫 로드)
   * 캔버스 DOM이 아직 없을 때 측정이 0이 되는 경우가 있어, focusQueryNodeOnCanvas 안에서 재시도한다.
   */
  useEffect(() => {
    if (!ready || !state.keyword || isMobile) {
      prevDesktopViewRef.current = desktopViewMode;
      return;
    }
    const prev = prevDesktopViewRef.current;
    const root = state.nodes.find((n) => n.type === 'root');
    if (!root) {
      prevDesktopViewRef.current = desktopViewMode;
      return;
    }

    const shouldFocusRoot =
      desktopViewMode === 'canvas' && (prev === 'cards' || prev === null);

    if (shouldFocusRoot) {
      const z = state.viewport.zoom;
      focusQueryNodeOnCanvas(root, z, dispatch);
    }
    prevDesktopViewRef.current = desktopViewMode;
  }, [ready, state.keyword, isMobile, desktopViewMode, state.nodes, state.viewport.zoom, dispatch]);

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
  const mobileMode = isMobile;
  const useCardMode = mobileMode || desktopViewMode === 'cards';

  return (
    <div id="workspace-export-all-target" className="relative h-screen w-screen overflow-hidden bg-background">
      <Toolbar
        onToggleDashboard={() => {
          setShowDashboard((v) => {
            if (v) {
              setDashboardExpanded(false);
            } else {
              const mobile = typeof window !== 'undefined' && window.innerWidth < 768;
              const wide = typeof window !== 'undefined' && window.innerWidth >= 1280;
              setDashboardExpanded(mobile || wide);
            }
            return !v;
          });
        }}
        showDashboard={showDashboard}
        desktopViewMode={desktopViewMode}
        onDesktopViewModeChange={setDesktopViewMode}
      />

      {useCardMode ? (
        <MobileWorkspaceShell
          showDashboard={showDashboard}
          isMobile={mobileMode}
        />
      ) : (
        <div
          id="workspace-tree-export-target"
          className="absolute inset-0"
          style={{
            right: showDashboard && !dashboardExpanded && !isMobile ? '480px' : 0,
            opacity: canvasObscured ? 0 : 1,
            pointerEvents: canvasObscured ? 'none' : 'auto',
            transition: 'right 0.3s ease, opacity 0.25s ease',
          }}
        >
          <Canvas />
        </div>
      )}

      {!canvasObscured && !isMobile && !useCardMode && <MiniMap />}

      {!mobileMode && !useCardMode && showDashboard && (
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
        style={{ display: useCardMode ? 'none' : undefined }}
      >
        <span className="mb-0.5 text-xs font-medium text-muted-foreground">{t('workspace.legendTitle')}</span>
        {[
          { color: '#00C49A', labelKey: 'workspace.legendRoot' as const },
          { color: '#60A5FA', labelKey: 'workspace.legendQuery' as const },
          { color: '#D97706', labelKey: 'workspace.legendTemplate' as const },
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
