'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Download, FolderOpen, HardDrive, LayoutGrid, Upload } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageSwitcher } from '@/components/language-switcher';
import { useI18n } from '@/components/i18n-provider';
import { useWorkspace } from '@/lib/workspace-store';
import { SNAPSHOT_ERROR_I18N_KEY } from '@/lib/i18n/snapshot-errors';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { GoalType, WorkspaceState } from '@/lib/types';
import { GOAL_LABEL_KEYS } from '@/lib/i18n/goal-keys';
import {
  downloadWorkspaceJson,
  hasWorkspaceInLocalStorage,
  loadWorkspaceFromLocalStorage,
  parseWorkspaceSnapshotString,
  saveWorkspaceToLocalStorage,
} from '@/lib/workspace-snapshot';
import { listRecentWorkspaces } from '@/lib/workspace-index';
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

const NEW_WORKSPACE_GOALS: GoalType[] = ['learn', 'research', 'build', 'analyze', 'strategize'];

interface ToolbarProps {
  onToggleDashboard: () => void;
  showDashboard: boolean;
}

export function Toolbar({ onToggleDashboard, showDashboard }: ToolbarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const { state, dispatch } = useWorkspace();
  const { keyword, goal, viewport, dashboardNodeIds } = state;
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const pendingSnapshotRef = useRef<WorkspaceState | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [hasBrowserSave, setHasBrowserSave] = useState(false);
  const [newWorkspaceOpen, setNewWorkspaceOpen] = useState(false);
  const [newKeyword, setNewKeyword] = useState('');
  const [newGoal, setNewGoal] = useState<GoalType>('learn');
  const [recentOpen, setRecentOpen] = useState(false);

  useEffect(() => {
    setHasBrowserSave(hasWorkspaceInLocalStorage(keyword));
  }, [keyword]);

  const zoomIn = () =>
    dispatch({ type: 'SET_VIEWPORT', viewport: { zoom: Math.min(viewport.zoom + 0.1, 2) } });
  const zoomOut = () =>
    dispatch({ type: 'SET_VIEWPORT', viewport: { zoom: Math.max(viewport.zoom - 0.1, 0.2) } });
  const fitView = () =>
    dispatch({ type: 'SET_VIEWPORT', viewport: { x: 120, y: 80, zoom: 0.72 } });
  
  const autoLayout = () => {
    dispatch({ type: 'AUTO_LAYOUT' });
  };

  const saveToBrowser = () => {
    const r = saveWorkspaceToLocalStorage(state);
    if (r.ok) {
      setHasBrowserSave(true);
      toast.success(t('toolbar.browserSaved'));
    } else {
      toast.error(t(SNAPSHOT_ERROR_I18N_KEY[r.code]));
    }
  };

  const requestLoadFromBrowser = () => {
    const r = loadWorkspaceFromLocalStorage(keyword);
    if (!r.ok) {
      toast.error(t(SNAPSHOT_ERROR_I18N_KEY[r.code]));
      return;
    }
    pendingSnapshotRef.current = r.state;
    setLoadDialogOpen(true);
  };

  const applyLoadedSnapshot = () => {
    const snap = pendingSnapshotRef.current;
    if (!snap) return;
    dispatch({ type: 'LOAD_SNAPSHOT', snapshot: snap });
    const ws = searchParams.get('ws') ?? 'default';
    router.replace(
      workspaceUrl({
        keyword: snap.keyword,
        goal: snap.goal,
        ws,
      })
    );
    pendingSnapshotRef.current = null;
    setLoadDialogOpen(false);
    setHasBrowserSave(hasWorkspaceInLocalStorage(snap.keyword));
    toast.success(t('toolbar.loaded'));
  };

  const openNewWorkspaceDialog = () => {
    setNewKeyword('');
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
    router.push(workspaceUrl({ keyword: k, goal: newGoal }));
  };

  const goToRecent = (entry: { keyword: string; goal: GoalType }) => {
    setRecentOpen(false);
    router.push(workspaceUrl({ keyword: entry.keyword, goal: entry.goal }));
  };

  const onPickJsonFile: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    void file.text().then((text) => {
      const r = parseWorkspaceSnapshotString(text);
      if (!r.ok) {
        toast.error(t(SNAPSHOT_ERROR_I18N_KEY[r.code]));
        return;
      }
      pendingSnapshotRef.current = r.state;
      setLoadDialogOpen(true);
    });
  };

  const zoomPct = Math.round(viewport.zoom * 100);

  const recent = listRecentWorkspaces(10);

  return (
    <header className="pointer-events-none absolute left-0 right-0 top-0 z-40 flex items-start justify-between gap-4 p-4">
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

      {/* Left: Logo + keyword */}
      <div className="pointer-events-auto flex max-w-[min(100%,520px)] flex-wrap items-center gap-2 rounded-2xl border border-border bg-card/90 px-4 py-2.5 backdrop-blur-sm sm:flex-nowrap sm:gap-3">
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
          className="rounded-full px-2 py-0.5 text-xs font-medium"
          style={{ background: 'rgba(0,196,154,0.15)', color: '#00C49A' }}
        >
          {t(GOAL_LABEL_KEYS[goal])}
        </span>
        <DropdownMenu open={recentOpen} onOpenChange={setRecentOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/60 px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <LayoutGrid className="size-3.5" />
              {t('toolbar.workspaces')}
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
                  <span className="text-xs text-muted-foreground">{t(GOAL_LABEL_KEYS[e.goal])}</span>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Right: Theme + save/load + dashboard + zoom */}
      <div className="pointer-events-auto flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          aria-hidden
          onChange={onPickJsonFile}
        />
        <AlertDialog
          open={loadDialogOpen}
          onOpenChange={(open) => {
            setLoadDialogOpen(open);
            if (!open) pendingSnapshotRef.current = null;
          }}
        >
          <AlertDialogContent className="border-border sm:max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle>{t('toolbar.loadSnapshotTitle')}</AlertDialogTitle>
              <AlertDialogDescription>{t('toolbar.loadSnapshotDesc')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={applyLoadedSnapshot}
              >
                {t('toolbar.loadConfirm')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="relative flex items-center gap-2 rounded-xl border border-border bg-card/90 px-4 py-2 text-sm font-medium text-muted-foreground backdrop-blur-sm transition-all hover:bg-secondary hover:text-foreground"
            >
              <FolderOpen className="size-4" />
              {t('toolbar.saveLoad')}
              {hasBrowserSave && (
                <span
                  className="absolute right-2 top-2 size-1.5 rounded-full bg-primary"
                  title={t('toolbar.hasBrowserSave')}
                  aria-hidden
                />
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              {t('toolbar.persistHint')}
            </DropdownMenuLabel>
            <DropdownMenuItem onSelect={saveToBrowser}>
              <HardDrive className="mr-2 size-4" />
              {t('toolbar.saveToBrowser')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={requestLoadFromBrowser}>
              <FolderOpen className="mr-2 size-4" />
              {t('toolbar.loadFromBrowser')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                downloadWorkspaceJson(state);
                toast.success(t('toolbar.jsonExported'));
              }}
            >
              <Download className="mr-2 size-4" />
              {t('toolbar.saveJson')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                window.setTimeout(() => fileInputRef.current?.click(), 0);
              }}
            >
              <Upload className="mr-2 size-4" />
              {t('toolbar.loadJson')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <LanguageSwitcher />
        <ThemeToggle />
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

        {/* Auto layout button */}
        <button
          onClick={autoLayout}
          className="flex items-center gap-2 rounded-xl border border-border bg-card/90 px-4 py-2 text-sm font-medium text-muted-foreground transition-all hover:text-foreground hover:bg-secondary"
          title={t('toolbar.layoutAutoHint')}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9h12M6 9a3 3 0 1 1 6 0M18 9a3 3 0 0 0-6 0M9 15h6M9 15a3 3 0 1 1 6 0M15 15a3 3 0 0 0-6 0" />
          </svg>
          {t('toolbar.layoutAuto')}
        </button>

        {/* Zoom controls */}
        <div className="flex items-center gap-1 rounded-xl border border-border bg-card/90 p-1 backdrop-blur-sm">
          <button
            onClick={zoomOut}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            aria-label={t('toolbar.zoomOut')}
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
      </div>
    </header>
  );
}
