'use client';

import { useWorkspace } from '@/lib/workspace-store';

interface ToolbarProps {
  onToggleDashboard: () => void;
  showDashboard: boolean;
}

export function Toolbar({ onToggleDashboard, showDashboard }: ToolbarProps) {
  const { state, dispatch } = useWorkspace();
  const { keyword, goal, viewport, dashboardNodeIds } = state;

  const zoomIn = () =>
    dispatch({ type: 'SET_VIEWPORT', viewport: { zoom: Math.min(viewport.zoom + 0.1, 2) } });
  const zoomOut = () =>
    dispatch({ type: 'SET_VIEWPORT', viewport: { zoom: Math.max(viewport.zoom - 0.1, 0.2) } });
  const fitView = () =>
    dispatch({ type: 'SET_VIEWPORT', viewport: { x: 120, y: 80, zoom: 0.72 } });
  
  const autoLayout = () => {
    dispatch({ type: 'AUTO_LAYOUT' });
  };

  const zoomPct = Math.round(viewport.zoom * 100);

  return (
    <header className="pointer-events-none absolute left-0 right-0 top-0 z-20 flex items-start justify-between gap-4 p-4">
      {/* Left: Logo + keyword */}
      <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-border bg-card/90 px-4 py-2.5 backdrop-blur-sm">
        <svg width="22" height="22" viewBox="0 0 36 36" fill="none">
          <rect x="2" y="6" width="16" height="16" stroke="#00C49A" strokeWidth="1.5" />
          <rect x="8" y="12" width="16" height="16" stroke="#00C49A" strokeWidth="1.5" opacity="0.6" />
          <line x1="2" y1="6" x2="8" y2="12" stroke="#00C49A" strokeWidth="1.5" />
          <line x1="18" y1="6" x2="24" y2="12" stroke="#00C49A" strokeWidth="1.5" />
          <line x1="2" y1="22" x2="8" y2="28" stroke="#00C49A" strokeWidth="1.5" />
          <line x1="18" y1="22" x2="24" y2="28" stroke="#00C49A" strokeWidth="1.5" />
          <circle cx="18" cy="18" r="2" fill="#00C49A" />
        </svg>
        <span className="font-bold text-foreground" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
          qx<span style={{ color: '#00C49A' }}>10</span>.ai
        </span>
        <div className="mx-1 h-4 w-px bg-border" />
        <span className="text-sm font-medium text-foreground">{keyword}</span>
        <span
          className="rounded-full px-2 py-0.5 text-xs font-medium capitalize"
          style={{ background: 'rgba(0,196,154,0.15)', color: '#00C49A' }}
        >
          {goal}
        </span>
      </div>

      {/* Right: Dashboard + zoom controls */}
      <div className="pointer-events-auto flex items-center gap-2">
        {/* Dashboard toggle */}
        <button
          onClick={onToggleDashboard}
          className={[
            'flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-all',
            showDashboard
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border bg-card/90 text-muted-foreground hover:text-foreground backdrop-blur-sm',
          ].join(' ')}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
          Dashboard
          {dashboardNodeIds.length > 0 && (
            <span
              className="flex h-4 w-4 items-center justify-center rounded-full text-xs"
              style={{ background: '#00C49A', color: '#080C12' }}
            >
              {dashboardNodeIds.length}
            </span>
          )}
        </button>

        {/* Auto layout button */}
        <button
          onClick={autoLayout}
          className="flex items-center gap-2 rounded-xl border border-border bg-card/90 px-4 py-2 text-sm font-medium text-muted-foreground transition-all hover:text-foreground hover:bg-secondary"
          title="Auto-arrange nodes in tree layout"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9h12M6 9a3 3 0 1 1 6 0M18 9a3 3 0 0 0-6 0M9 15h6M9 15a3 3 0 1 1 6 0M15 15a3 3 0 0 0-6 0" />
          </svg>
          Layout
        </button>

        {/* Zoom controls */}
        <div className="flex items-center gap-1 rounded-xl border border-border bg-card/90 p-1 backdrop-blur-sm">
          <button
            onClick={zoomOut}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            aria-label="Zoom out"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /><line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          </button>
          <span className="min-w-[3rem] text-center text-xs font-mono text-muted-foreground">
            {zoomPct}%
          </span>
          <button
            onClick={zoomIn}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            aria-label="Zoom in"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /><line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          </button>
          <button
            onClick={fitView}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            aria-label="Fit view"
            title="Fit view"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
