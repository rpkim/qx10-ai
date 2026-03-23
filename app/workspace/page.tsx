'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { WorkspaceProvider, useWorkspace } from '@/lib/workspace-store';
import type { GoalType } from '@/lib/types';
import { Canvas } from '@/components/workspace/canvas';
import { Toolbar } from '@/components/workspace/toolbar';
import { MiniMap } from '@/components/workspace/minimap';
import { DashboardPanel } from '@/components/workspace/dashboard-panel';

export default function WorkspacePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-screen items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-4">
            <div
              className="h-10 w-10 rounded-full border-2"
              style={{ borderColor: '#00C49A', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }}
            />
            <span className="text-sm text-muted-foreground">Loading workspace...</span>
          </div>
        </div>
      }
    >
      <WorkspaceProvider>
        <WorkspaceInner />
      </WorkspaceProvider>
    </Suspense>
  );
}

function WorkspaceInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { initWorkspace, state } = useWorkspace();
  const [showDashboard, setShowDashboard] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const keyword = searchParams.get('keyword');
    const goal = (searchParams.get('goal') as GoalType) || 'learn';
    if (keyword) {
      initWorkspace(keyword, goal);
      setReady(true);
    } else {
      router.replace('/');
    }
  }, []);

  if (!ready || !state.keyword) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div
            className="h-10 w-10 rounded-full border-2"
            style={{ borderColor: '#00C49A', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }}
          />
          <span className="text-sm text-muted-foreground">Initializing workspace...</span>
        </div>
        <style jsx>{`
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-background">
      {/* Toolbar */}
      <Toolbar
        onToggleDashboard={() => setShowDashboard((v) => !v)}
        showDashboard={showDashboard}
      />

      {/* Main canvas */}
      <div
        className="absolute inset-0"
        style={{ right: showDashboard ? '480px' : 0, transition: 'right 0.3s ease' }}
      >
        <Canvas />
      </div>

      {/* MiniMap */}
      {!showDashboard && <MiniMap />}

      {/* Dashboard panel */}
      {showDashboard && <DashboardPanel onClose={() => setShowDashboard(false)} />}

      {/* Legend */}
      <div
        className="absolute bottom-4 left-4 z-10 flex flex-col gap-1.5 rounded-xl border border-border bg-card/90 px-3 py-3 backdrop-blur-sm"
        aria-label="Node legend"
      >
        <span className="mb-0.5 text-xs font-medium text-muted-foreground">Legend</span>
        {[
          { color: '#00C49A', label: 'Root keyword' },
          { color: '#60A5FA', label: 'Query' },
          { color: '#A3E635', label: 'Answer' },
          { color: '#F59E0B', label: 'Data / Visual' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: color }}
            />
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
        ))}
        <div className="mt-1.5 flex items-center gap-2 border-t border-border pt-1.5">
          <span className="text-xs text-muted-foreground/60">Scroll to zoom · Drag to pan</span>
        </div>
      </div>
    </div>
  );
}
