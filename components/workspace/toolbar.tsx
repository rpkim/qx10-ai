'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  FileText,
  Home,
  LayoutGrid,
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageSwitcher } from '@/components/language-switcher';
import { useI18n } from '@/components/i18n-provider';
import { useWorkspace } from '@/lib/workspace-store';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { GoalType } from '@/lib/types';
import { GOAL_LABEL_KEYS } from '@/lib/i18n/goal-keys';
import { collectQaSources } from '@/lib/article-markdown';
import { listRecentWorkspacesAsync, type WorkspaceIndexEntry } from '@/lib/workspace-index';
import { workspaceUrl } from '@/lib/workspace-url';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { WorkspaceNodeSearchBar } from '@/components/workspace/node-search-bar';
import { ContextChipInput } from '@/components/workspace/context-chip-input';
import { formatContextForDisplay } from '@/lib/context-items';

const NEW_WORKSPACE_GOALS: GoalType[] = ['learn', 'research', 'build', 'analyze', 'strategize'];

interface ToolbarProps {
  onToggleDashboard: () => void;
  showDashboard: boolean;
  desktopViewMode: 'canvas' | 'cards';
  onDesktopViewModeChange: (mode: 'canvas' | 'cards') => void;
  onOpenArticleStudio: () => void;
}

export function Toolbar({
  onToggleDashboard,
  showDashboard,
  desktopViewMode,
  onDesktopViewModeChange,
  onOpenArticleStudio,
}: ToolbarProps) {
  const router = useRouter();
  const { t } = useI18n();
  const { state, dispatch, autoLayout } = useWorkspace();
  const { keyword, goal, viewport, dashboardNodeIds } = state;
  const [newWorkspaceOpen, setNewWorkspaceOpen] = useState(false);
  const [newKeyword, setNewKeyword] = useState('');
  const [newContext, setNewContext] = useState('');
  const [newGoal, setNewGoal] = useState<GoalType>('learn');
  const [recentOpen, setRecentOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [recent, setRecent] = useState<WorkspaceIndexEntry[]>([]);

  useEffect(() => {
    void listRecentWorkspacesAsync(10).then(setRecent);
  }, [state.keyword]);

  useEffect(() => {
    const apply = () => setIsMobile(window.innerWidth < 768);
    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, []);

  const zoomIn = () =>
    dispatch({ type: 'SET_VIEWPORT', viewport: { zoom: Math.min(viewport.zoom + 0.1, 2) } });
  const zoomOut = () =>
    dispatch({ type: 'SET_VIEWPORT', viewport: { zoom: Math.max(viewport.zoom - 0.1, 0.2) } });
  const fitView = () =>
    dispatch({ type: 'SET_VIEWPORT', viewport: { x: 120, y: 80, zoom: 0.72 } });
  
  const autoLayoutCanvas = () => {
    autoLayout();
  };

  const openNewWorkspaceDialog = () => {
    setNewKeyword('');
    setNewContext('');
    setNewGoal(goal);
    setNewWorkspaceOpen(true);
  };

  const confirmNewWorkspace = () => {
    const k = newKeyword.trim();
    if (!k) {
      toast.error(t('toolbar.enterKeyword'));
      return;
    }
    setNewWorkspaceOpen(false);
    router.push(workspaceUrl({ keyword: k, goal: newGoal, context: newContext.trim() || undefined }));
  };

  const goToRecent = (entry: { keyword: string; goal: GoalType; context?: string }) => {
    setRecentOpen(false);
    router.push(workspaceUrl({ keyword: entry.keyword, goal: entry.goal, context: entry.context }));
  };

  const zoomPct = Math.round(viewport.zoom * 100);
  /** At least a few completed Q&A pairs, otherwise there is nothing to synthesize. */
  const canWriteArticle = useMemo(
    () => collectQaSources(state.nodes).length >= 3,
    [state.nodes]
  );

  return (
    <header className="pointer-events-none absolute left-0 right-0 top-0 z-40 flex flex-col items-stretch justify-between gap-2 p-2 pt-[max(0.5rem,env(safe-area-inset-top))] pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] sm:flex-row sm:items-start sm:gap-4 sm:p-4 sm:pt-[max(1rem,env(safe-area-inset-top))] sm:pl-[max(1rem,env(safe-area-inset-left))] sm:pr-[max(1rem,env(safe-area-inset-right))]">
      <Dialog open={newWorkspaceOpen} onOpenChange={setNewWorkspaceOpen}>
        <DialogContent className="border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('toolbar.newWorkspace')}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">{t('toolbar.topicKeyword')}</span>
              <Input
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                placeholder={t('toolbar.topicPlaceholder')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirmNewWorkspace();
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">{t('toolbar.contextLabel')}</span>
                <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground/60">{t('toolbar.contextOptional')}</span>
                <span className="text-[10px] text-muted-foreground/50">{t('toolbar.contextUrlHint')}</span>
              </div>
              <div className="flex min-h-9 w-full min-w-0 flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent px-3 py-1.5 shadow-xs">
                <ContextChipInput
                  value={newContext}
                  onChange={setNewContext}
                  onEnterWithEmptyDraft={confirmNewWorkspace}
                  placeholder={t('toolbar.contextPlaceholder')}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">{t('toolbar.exploreMode')}</span>
              <div className="flex flex-wrap gap-1.5">
                {NEW_WORKSPACE_GOALS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setNewGoal(id)}
                    className={[
                      'rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors',
                      newGoal === id
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-secondary/50 text-muted-foreground hover:text-foreground',
                    ].join(' ')}
                  >
                    {t(GOAL_LABEL_KEYS[id])}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setNewWorkspaceOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="button" onClick={confirmNewWorkspace}>
              {t('toolbar.openWorkspace')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {isMobile && (
        <div className="pointer-events-auto w-full max-w-[100vw] rounded-2xl border border-border bg-card/95 px-2 py-2 backdrop-blur-sm">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => router.push('/')}
              className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              title="Home"
            >
              <Home className="size-4" />
            </button>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-foreground">{keyword}</div>
              <div className="truncate text-xs text-muted-foreground">{t(GOAL_LABEL_KEYS[goal])}</div>
            </div>
          </div>
          <div className="mt-2 flex flex-nowrap items-center justify-end gap-1.5 overflow-x-auto border-t border-border/60 pt-2 [scrollbar-width:none]">
            {canWriteArticle && (
              <button
                type="button"
                onClick={onOpenArticleStudio}
                className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                title={t('article.open')}
              >
                <FileText className="size-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onToggleDashboard}
              className={[
                'flex size-8 shrink-0 items-center justify-center rounded-lg border transition-colors',
                showDashboard
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:bg-secondary hover:text-foreground',
              ].join(' ')}
              title={t('toolbar.dashboard')}
            >
              <LayoutGrid className="size-4" />
            </button>
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>
      )}

      {/* Left: Logo + keyword + node search */}
      <div className={["pointer-events-auto flex w-full max-w-[min(100%,520px)] min-w-0 flex-col gap-2 rounded-2xl border border-border bg-card/90 px-3 py-2 backdrop-blur-sm sm:px-4 sm:py-2.5", isMobile ? "hidden sm:flex" : ""].join(' ')}>
        <div className="flex flex-wrap items-center gap-1.5 sm:flex-nowrap sm:gap-3">
          <button
            type="button"
            onClick={() => router.push('/')}
            className="flex items-center gap-2 rounded-lg px-1 py-0.5 transition-colors hover:bg-secondary"
            title="Go to home"
          >
            <svg width="22" height="22" viewBox="0 0 36 36" fill="none">
              <rect x="2" y="6" width="16" height="16" stroke="#00C49A" strokeWidth="1.5" />
              <rect x="8" y="12" width="16" height="16" stroke="#00C49A" strokeWidth="1.5" opacity="0.6" />
              <line x1="2" y1="6" x2="8" y2="12" stroke="#00C49A" strokeWidth="1.5" />
              <line x1="18" y1="6" x2="24" y2="12" stroke="#00C49A" strokeWidth="1.5" />
              <line x1="2" y1="22" x2="8" y2="28" stroke="#00C49A" strokeWidth="1.5" />
              <line x1="18" y1="22" x2="24" y2="28" stroke="#00C49A" strokeWidth="1.5" />
              <circle cx="18" cy="18" r="2" fill="#00C49A" />
            </svg>
            <span
              className="font-bold text-foreground"
              style={{ fontFamily: 'var(--font-space-grotesk)' }}
              suppressHydrationWarning
            >
              Qx<span style={{ color: '#00C49A' }}>10</span>.lol
            </span>
          </button>
          <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
            Qx10
          </span>
          <div className="mx-1 h-4 w-px bg-border" />
          <span className="min-w-0 max-w-[120px] truncate text-sm font-semibold text-foreground sm:max-w-[180px]">{keyword}</span>
          <span
            className="shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold sm:text-sm"
            style={{ background: 'rgba(0,196,154,0.15)', color: '#00C49A' }}
          >
            {t(GOAL_LABEL_KEYS[goal])}
          </span>
          <DropdownMenu open={recentOpen} onOpenChange={setRecentOpen}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-secondary/60 px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground sm:px-2.5 sm:text-sm"
                title={t('toolbar.workspaces')}
              >
                <LayoutGrid className="size-3.5 sm:size-4" />
                <span className="hidden sm:inline">{t('toolbar.workspaces')}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setRecentOpen(false);
                  window.setTimeout(() => openNewWorkspaceDialog(), 0);
                }}
              >
                {t('toolbar.newWorkspaceEllipsis')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                {t('toolbar.recentTopics')}
              </DropdownMenuLabel>
              {recent.length === 0 ? (
                <div className="px-2 py-2 text-xs text-muted-foreground">{t('toolbar.noRecent')}</div>
              ) : (
                recent.map((e) => (
                  <DropdownMenuItem
                    key={`${e.keyword}-${e.updatedAt}`}
                    onSelect={() => goToRecent(e)}
                    className="flex flex-col items-start gap-0.5"
                  >
                    <span className="font-medium text-foreground">{e.keyword}</span>
                    {e.context && (
                      <span className="truncate text-[11px] italic text-muted-foreground/70">
                        in &ldquo;{formatContextForDisplay(e.context)}&rdquo;
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">{t(GOAL_LABEL_KEYS[e.goal])}</span>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <WorkspaceNodeSearchBar />
      </div>

      {/* Right: dashboard + zoom */}
      <div className={["pointer-events-auto flex flex-wrap items-center gap-1.5 sm:gap-2", isMobile ? "hidden sm:flex" : ""].join(' ')}>
        <LanguageSwitcher />
        <ThemeToggle />
        {canWriteArticle && (
          <button
            type="button"
            onClick={onOpenArticleStudio}
            className="flex items-center gap-2 rounded-xl border border-border bg-card/90 px-3 py-2 text-sm font-medium text-muted-foreground backdrop-blur-sm transition-all hover:bg-secondary hover:text-foreground"
            title={t('article.openHint')}
          >
            <FileText className="size-4" />
            {t('article.open')}
          </button>
        )}
        {!isMobile && (
          <div className="flex items-center rounded-xl border border-border bg-card/90 p-1 backdrop-blur-sm">
            <button
              type="button"
              onClick={() => onDesktopViewModeChange('canvas')}
              className={[
                'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
                desktopViewMode === 'canvas'
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              Canvas
            </button>
            <button
              type="button"
              onClick={() => onDesktopViewModeChange('cards')}
              className={[
                'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
                desktopViewMode === 'cards'
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              Cards
            </button>
          </div>
        )}
        {/* Dashboard toggle */}
        <button
          onClick={onToggleDashboard}
          className={[
            'flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm font-medium transition-all sm:px-4 sm:py-2',
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
          {t('toolbar.dashboard')}
          {dashboardNodeIds.length > 0 && (
            <span
              className="flex h-4 w-4 items-center justify-center rounded-full text-xs"
              style={{ background: '#00C49A', color: '#080C12' }}
            >
              {dashboardNodeIds.length}
            </span>
          )}
        </button>

        {/* Auto layout — canvas only (irrelevant in Cards / mobile card view) */}
        {desktopViewMode === 'canvas' && (
          <button
            onClick={autoLayoutCanvas}
            className="hidden items-center gap-2 rounded-xl border border-border bg-card/90 px-4 py-2 text-sm font-medium text-muted-foreground transition-all hover:bg-secondary hover:text-foreground sm:flex"
            title={t('toolbar.layoutAutoHint')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9h12M6 9a3 3 0 1 1 6 0M18 9a3 3 0 0 0-6 0M9 15h6M9 15a3 3 0 1 1 6 0M15 15a3 3 0 0 0-6 0" />
            </svg>
            {t('toolbar.layoutAuto')}
          </button>
        )}

        {/* Zoom controls — canvas only */}
        {desktopViewMode === 'canvas' && !isMobile && (
        <div className="hidden items-center gap-1 rounded-xl border border-border bg-card/90 p-1 backdrop-blur-sm sm:flex">
          <button
            onClick={zoomOut}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            aria-label={t('toolbar.zoomOut')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /><line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          </button>
          <span className="min-w-12 text-center text-xs font-mono text-muted-foreground">
            {zoomPct}%
          </span>
          <button
            onClick={zoomIn}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            aria-label={t('toolbar.zoomIn')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /><line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          </button>
          <button
            onClick={fitView}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            aria-label={t('toolbar.fitView')}
            title={t('toolbar.fitView')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
          </button>
        </div>
        )}
      </div>
    </header>
  );
}

