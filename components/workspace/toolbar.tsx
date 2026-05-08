'use client';

import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  CloudUpload,
  Download,
  FileImage,
  FileText,
  FolderOpen,
  LayoutGrid,
  LayoutTemplate,
  Pencil,
  Trash2,
  Upload,
} from 'lucide-react';
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
  DropdownMenuGroup,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { GoalType, Position, WorkspaceState, WorkspaceNode } from '@/lib/types';
import { GOAL_LABEL_KEYS } from '@/lib/i18n/goal-keys';
import {
  downloadWorkspaceJson,
  listAllWorkspaceKeywordsInLocalStorage,
  loadWorkspaceFromLocalStorage,
  parseWorkspaceSnapshotString,
  serializeWorkspaceSnapshot,
} from '@/lib/workspace-snapshot';
import {
  exportWorkspaceTreePdf,
  exportWorkspaceTreePng,
} from '@/lib/workspace-visual-export';
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
import { QuestionTemplateDesignerDialog } from '@/components/question-template-designer-dialog';
import { WorkspaceNodeSearchBar } from '@/components/workspace/node-search-bar';
import {
  deleteQuestionTemplate,
  loadQuestionTemplates,
  type QuestionTemplate,
} from '@/lib/question-templates';

const NEW_WORKSPACE_GOALS: GoalType[] = ['learn', 'research', 'build', 'analyze', 'strategize'];

interface ToolbarProps {
  onToggleDashboard: () => void;
  showDashboard: boolean;
  desktopViewMode: 'canvas' | 'cards';
  onDesktopViewModeChange: (mode: 'canvas' | 'cards') => void;
}

export function Toolbar({
  onToggleDashboard,
  showDashboard,
  desktopViewMode,
  onDesktopViewModeChange,
}: ToolbarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const {
    state,
    dispatch,
    addQueryTemplateNode,
  } = useWorkspace();
  const { keyword, goal, viewport, dashboardNodeIds } = state;
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const pendingSnapshotRef = useRef<WorkspaceState | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newWorkspaceOpen, setNewWorkspaceOpen] = useState(false);
  const [newKeyword, setNewKeyword] = useState('');
  const [newGoal, setNewGoal] = useState<GoalType>('learn');
  const [recentOpen, setRecentOpen] = useState(false);
  const [tplList, setTplList] = useState<QuestionTemplate[]>([]);
  const [tplDesigner, setTplDesigner] = useState<{
    open: boolean;
    templateId: string | null;
    seed: QuestionTemplate | null;
  }>({ open: false, templateId: null, seed: null });
  const [deleteTplId, setDeleteTplId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryBusy, setSummaryBusy] = useState(false);
  const [summaryText, setSummaryText] = useState('');
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [driveConnected, setDriveConnected] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/integrations/google/drive/status', { credentials: 'include' })
      .then((r) => r.json() as Promise<{ connected?: boolean }>)
      .then((d) => {
        if (!cancelled) setDriveConnected(!!d.connected);
      })
      .catch(() => {
        if (!cancelled) setDriveConnected(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const apply = () => setIsMobile(window.innerWidth < 768);
    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, []);

  const refreshTplList = () => setTplList(loadQuestionTemplates());

  const openTplDesignerNew = () => {
    setTplDesigner({
      open: true,
      templateId: null,
      seed: {
        id: `draft-${Date.now()}`,
        name: '',
        pattern: '',
        toolChoice: 'auto',
        followUpQuestions: [],
      },
    });
  };

  const openTplDesignerEdit = (tpl: QuestionTemplate) => {
    setTplDesigner({
      open: true,
      templateId: tpl.id,
      seed: { ...tpl },
    });
  };

  const confirmDeleteTemplate = () => {
    if (deleteTplId) {
      deleteQuestionTemplate(deleteTplId);
      refreshTplList();
    }
    setDeleteTplId(null);
  };

  const positionForNewTemplateNode = (nodes: WorkspaceNode[]): Position => {
    const root = nodes.find((n) => n.type === 'root');
    if (root) {
      const rw = root.width ?? 260;
      return { x: root.position.x + rw + 140, y: root.position.y };
    }
    return { x: 400, y: 200 };
  };

  const placeTemplateOnCanvas = (tpl: QuestionTemplate) => {
    addQueryTemplateNode({
      displayName: tpl.name,
      pattern: tpl.pattern,
      position: positionForNewTemplateNode(state.nodes),
      toolChoice: tpl.toolChoice,
      followUpQuestions: tpl.followUpQuestions,
    });
    toast.success(t('toolbar.templatePlaced'));
  };

  const zoomIn = () =>
    dispatch({ type: 'SET_VIEWPORT', viewport: { zoom: Math.min(viewport.zoom + 0.1, 2) } });
  const zoomOut = () =>
    dispatch({ type: 'SET_VIEWPORT', viewport: { zoom: Math.max(viewport.zoom - 0.1, 0.2) } });
  const fitView = () =>
    dispatch({ type: 'SET_VIEWPORT', viewport: { x: 120, y: 80, zoom: 0.72 } });
  
  const autoLayout = () => {
    dispatch({ type: 'AUTO_LAYOUT' });
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

  const exportPng = () => {
    void exportWorkspaceTreePng(state.keyword)
      .then(() => toast.success(t('toolbar.exportPngDone')))
      .catch(() => toast.error(t('toolbar.exportImageFail')));
  };


  const exportPdf = () => {
    void exportWorkspaceTreePdf(state.keyword)
      .then(() => toast.success(t('toolbar.exportPdfDone')))
      .catch(() => toast.error(t('toolbar.exportImageFail')));
  };

  const backupToGoogleDrive = async () => {
    try {
      const snapshotJson = serializeWorkspaceSnapshot(state);
      const res = await fetch('/api/integrations/google/drive/push', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshotJson }),
      });
      if (!res.ok) {
        toast.error(t('toolbar.backupToGoogleDriveFail'));
        return;
      }
      toast.success(t('toolbar.backupToGoogleDriveDone'));
    } catch {
      toast.error(t('toolbar.backupToGoogleDriveFail'));
    }
  };

  const backupAllLocalToGoogleDrive = async () => {
    try {
      const keywords = listAllWorkspaceKeywordsInLocalStorage();
      if (keywords.length === 0) {
        toast.message(t('toolbar.backupAllToGoogleDriveNone'));
        return;
      }
      let pushed = 0;
      for (const kw of keywords) {
        const loaded = loadWorkspaceFromLocalStorage(kw);
        if (!loaded.ok) continue;
        const snapshotJson = serializeWorkspaceSnapshot(loaded.state);
        const res = await fetch('/api/integrations/google/drive/push', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ snapshotJson }),
        });
        if (res.ok) pushed += 1;
      }
      if (pushed === 0) {
        toast.error(t('toolbar.backupAllToGoogleDriveFail'));
      } else {
        toast.success(t('toolbar.backupAllToGoogleDriveDone', { count: pushed }));
      }
    } catch {
      toast.error(t('toolbar.backupAllToGoogleDriveFail'));
    }
  };

  const zoomPct = Math.round(viewport.zoom * 100);

  const recent = listRecentWorkspaces(10);
  const queryNodes = useMemo(() => state.nodes.filter((n) => n.type === 'query'), [state.nodes]);
  const answerNodes = useMemo(() => state.nodes.filter((n) => n.type === 'answer'), [state.nodes]);
  const qaPairs = useMemo(() => {
    const queryById = new Map(
      state.nodes
        .filter((n) => n.type === 'query')
        .map((n) => [n.id, n.question] as const)
    );
    return state.nodes
      .filter((n): n is Extract<WorkspaceNode, { type: 'answer' }> => n.type === 'answer')
      .map((a) => {
        const q = queryById.get(a.queryId);
        return q && a.content.trim()
          ? { question: q, answer: a.content.trim() }
          : null;
      })
      .filter((x): x is { question: string; answer: string } => !!x)
      .slice(-40);
  }, [state.nodes]);
  /** At least a few completed Q&A pairs (API needs non-empty pairs). */
  const canUseSummary = qaPairs.length >= 3;

  const generateSummary = async () => {
    if (!canUseSummary || summaryBusy) return;
    setSummaryBusy(true);
    setSummaryError(null);
    try {
      const res = await fetch('/api/workspace/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword,
          goal,
          pairs: qaPairs,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `Summary request failed (${res.status})`);
      }
      const data = (await res.json()) as { summary?: string };
      setSummaryText((data.summary ?? '').trim() || 'No summary generated.');
    } catch (e) {
      setSummaryError(e instanceof Error ? e.message : 'Failed to generate summary');
    } finally {
      setSummaryBusy(false);
    }
  };

  const openSummary = async () => {
    setSummaryOpen(true);
    if (summaryText) return;
    await generateSummary();
  };

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
      <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
        <DialogContent className="border-border sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Workspace Summary</DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto rounded-xl border border-border bg-card/50 p-4">
            {summaryBusy && (
              <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-background/70 p-4">
                <div
                  className="pointer-events-none absolute inset-0 opacity-[0.08]"
                  style={{
                    backgroundImage:
                      'linear-gradient(to right, #00C49A 1px, transparent 1px), linear-gradient(to bottom, #00C49A 1px, transparent 1px)',
                    backgroundSize: '22px 22px',
                  }}
                />
                <div className="relative flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-foreground">Processing your workspace with AI...</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Connecting questions, extracting signals, and drafting a one-page summary.
                    </div>
                    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary/80">
                      <div className="h-full w-2/5 animate-pulse rounded-full bg-primary" />
                    </div>
                    <div className="mt-2 flex items-center gap-1.5 text-[11px] text-primary/80">
                      <span className="h-1.5 w-1.5 animate-ping rounded-full bg-primary" />
                      <span>AI is working</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {!summaryBusy && summaryError && (
              <div className="text-sm text-destructive">{summaryError}</div>
            )}
            {!summaryBusy && !summaryError && (
              <div className="text-sm leading-relaxed text-foreground/90">
                {summaryText ? renderSummaryMarkdown(summaryText) : 'Summary is empty.'}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSummaryText('');
                setSummaryError(null);
                void generateSummary();
              }}
              disabled={summaryBusy}
            >
              Regenerate
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (!summaryText.trim()) return;
                const blob = new Blob([summaryText], { type: 'text/markdown;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                const safeKeyword = keyword.trim().replace(/\s+/g, '-').toLowerCase() || 'workspace';
                a.href = url;
                a.download = `qx10-summary-${safeKeyword}.md`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              disabled={summaryBusy || !summaryText.trim()}
            >
              Download .md
            </Button>
            <Button type="button" onClick={() => setSummaryOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <QuestionTemplateDesignerDialog
        open={tplDesigner.open}
        onOpenChange={(open) => {
          if (!open) setTplDesigner({ open: false, templateId: null, seed: null });
        }}
        templateId={tplDesigner.templateId}
        initialPattern={tplDesigner.seed?.pattern ?? ''}
        initialName={tplDesigner.seed?.name ?? ''}
        initialToolChoice={tplDesigner.seed?.toolChoice ?? 'auto'}
        initialFollowUpQuestions={tplDesigner.seed?.followUpQuestions ?? []}
        onSaved={refreshTplList}
      />

      <AlertDialog open={deleteTplId != null} onOpenChange={(o) => !o && setDeleteTplId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('toolbar.templateDeleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('toolbar.templateDeleteDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDeleteTemplate}
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isMobile && (
        <div className="pointer-events-auto w-full max-w-[100vw] rounded-2xl border border-border bg-card/95 px-2 py-2 backdrop-blur-sm">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => router.push('/')}
              className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              title="Home"
            >
              <FolderOpen className="size-4" />
            </button>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-foreground">{keyword}</div>
              <div className="truncate text-xs text-muted-foreground">{t(GOAL_LABEL_KEYS[goal])}</div>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-end gap-1.5 border-t border-border/60 pt-2">
            {canUseSummary && (
              <button
                type="button"
                onClick={() => void openSummary()}
                className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                title={t('dashboard.summary')}
              >
                <FileText className="size-4" />
              </button>
            )}
            <DropdownMenu onOpenChange={(o) => o && refreshTplList()}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  title={t('toolbar.templatesMenu')}
                  aria-label={t('toolbar.templatesMenu')}
                >
                  <LayoutTemplate className="size-4 text-amber-600 dark:text-amber-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="max-h-[min(70vh,420px)] w-[min(100vw-2rem,16rem)] overflow-y-auto"
              >
                <DropdownMenuItem
                  onSelect={() => {
                    window.setTimeout(() => openTplDesignerNew(), 0);
                  }}
                >
                  {t('toolbar.templateNew')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {tplList.length === 0 ? (
                  <div className="px-2 py-2 text-xs text-muted-foreground">{t('templates.emptyList')}</div>
                ) : (
                  tplList.map((tpl, idx) => (
                    <Fragment key={tpl.id}>
                      {idx > 0 && <DropdownMenuSeparator />}
                      <DropdownMenuGroup>
                        <DropdownMenuLabel className="max-w-[240px] truncate text-xs font-medium text-muted-foreground">
                          {tpl.name}
                        </DropdownMenuLabel>
                        <DropdownMenuItem
                          onSelect={(e) => {
                            e.preventDefault();
                            window.setTimeout(() => placeTemplateOnCanvas(tpl), 0);
                          }}
                        >
                          <LayoutTemplate className="mr-2 size-4 text-amber-600 dark:text-amber-400" />
                          {t('toolbar.templateAddToCanvas')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={(e) => {
                            e.preventDefault();
                            window.setTimeout(() => openTplDesignerEdit(tpl), 0);
                          }}
                        >
                          <Pencil className="mr-2 size-4" />
                          {t('toolbar.templateEdit')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={(e) => {
                            e.preventDefault();
                            window.setTimeout(() => setDeleteTplId(tpl.id), 0);
                          }}
                        >
                          <Trash2 className="mr-2 size-4" />
                          {t('toolbar.templateDelete')}
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                    </Fragment>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
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
        <WorkspaceNodeSearchBar />
      </div>

      {/* Right: Theme + save/load + dashboard + zoom */}
      <div className={["pointer-events-auto flex flex-wrap items-center gap-1.5 sm:gap-2", isMobile ? "hidden sm:flex" : ""].join(' ')}>
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
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[min(100vw-2rem,16rem)] sm:w-64">
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              {t('toolbar.saveLoadHint')}
            </DropdownMenuLabel>
            <DropdownMenuItem onSelect={exportPng}>
              <FileImage className="mr-2 size-4" />
              {t('toolbar.exportPng')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={exportPdf}>
              <FileText className="mr-2 size-4" />
              {t('toolbar.exportPdf')}
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
            {driveConnected && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    window.setTimeout(() => void backupToGoogleDrive(), 0);
                  }}
                >
                  <CloudUpload className="mr-2 size-4" />
                  {t('toolbar.backupToGoogleDrive')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    window.setTimeout(() => void backupAllLocalToGoogleDrive(), 0);
                  }}
                >
                  <CloudUpload className="mr-2 size-4" />
                  {t('toolbar.backupAllToGoogleDrive')}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu onOpenChange={(o) => o && refreshTplList()}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-xl border border-border bg-card/90 px-3 py-2 text-sm font-medium text-muted-foreground backdrop-blur-sm transition-all hover:bg-secondary hover:text-foreground"
            >
              <LayoutTemplate className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              {t('toolbar.templatesMenu')}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-[min(70vh,420px)] w-56 overflow-y-auto">
            <DropdownMenuItem
              onSelect={() => {
                window.setTimeout(() => openTplDesignerNew(), 0);
              }}
            >
              {t('toolbar.templateNew')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {tplList.length === 0 ? (
              <div className="text-muted-foreground px-2 py-2 text-xs">{t('templates.emptyList')}</div>
            ) : (
              tplList.map((tpl, idx) => (
                <Fragment key={tpl.id}>
                  {idx > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="text-muted-foreground max-w-[240px] truncate text-xs font-medium">
                      {tpl.name}
                    </DropdownMenuLabel>
                    <DropdownMenuItem
                      onSelect={(e) => {
                        e.preventDefault();
                        window.setTimeout(() => placeTemplateOnCanvas(tpl), 0);
                      }}
                    >
                      <LayoutTemplate className="size-4 text-amber-600 dark:text-amber-400" />
                      {t('toolbar.templateAddToCanvas')}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={(e) => {
                        e.preventDefault();
                        window.setTimeout(() => openTplDesignerEdit(tpl), 0);
                      }}
                    >
                      <Pencil className="size-4" />
                      {t('toolbar.templateEdit')}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={(e) => {
                        e.preventDefault();
                        window.setTimeout(() => setDeleteTplId(tpl.id), 0);
                      }}
                    >
                      <Trash2 className="size-4" />
                      {t('toolbar.templateDelete')}
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </Fragment>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <LanguageSwitcher />
        <ThemeToggle />
        {canUseSummary && (
          <button
            type="button"
            onClick={() => void openSummary()}
            className="flex items-center gap-2 rounded-xl border border-border bg-card/90 px-3 py-2 text-sm font-medium text-muted-foreground backdrop-blur-sm transition-all hover:bg-secondary hover:text-foreground"
            title="Workspace Summary"
          >
            <FileText className="size-4" />
            Summary
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
            onClick={autoLayout}
            className="hidden items-center gap-2 rounded-xl border border-border bg-card/90 px-4 py-2 text-sm font-medium text-muted-foreground transition-all hover:bg-secondary hover:text-foreground sm:flex"
            title={t('toolbar.layoutAutoHint')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9h12M6 9a3 3 0 1 1 6 0M18 9a3 3 0 0 0-6 0M9 15h6M9 15a3 3 0 1 1 6 0M15 15a3 3 0 0 0-6 0" />
            </svg>
            {t('toolbar.layoutAuto')}
          </button>
        )}

        {/* Zoom controls */}
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
      </div>
    </header>
  );
}

/** LLM often emits `* one * two` on one line; split so list items render with line breaks. */
function tryRenderInlineAsteriskList(trimmed: string, keyIdx: number): ReactNode | null {
  if (!/\*\s+\S/.test(trimmed)) return null;
  const segments = trimmed
    .split(/\s+(?=\*\s+)/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (segments.length < 2) return null;

  const isBulletItem = (s: string) => /^\*\s+/.test(s);

  if (segments.every(isBulletItem)) {
    return (
      <ul key={keyIdx} className="ml-4 list-disc space-y-1">
        {segments.map((line, lineIdx) => (
          <li key={lineIdx}>{formatSummaryBoldInline(line.replace(/^\*\s+/, ''))}</li>
        ))}
      </ul>
    );
  }

  const [first, ...rest] = segments;
  if (!isBulletItem(first) && rest.length > 0 && rest.every(isBulletItem)) {
    return (
      <div key={keyIdx} className="space-y-2">
        <p className="text-sm leading-relaxed text-foreground/90">{formatSummaryBoldInline(first)}</p>
        <ul className="ml-4 list-disc space-y-1">
          {rest.map((line, lineIdx) => (
            <li key={lineIdx}>{formatSummaryBoldInline(line.replace(/^\*\s+/, ''))}</li>
          ))}
        </ul>
      </div>
    );
  }

  return null;
}

function renderSummaryMarkdown(content: string): ReactElement {
  const blocks = content.split('\n\n').filter((b) => b.trim().length > 0);
  return (
    <div className="space-y-2">
      {blocks.map((block, idx) => {
        const trimmed = block.trim();
        const lines = trimmed.split('\n').filter(Boolean);
        const isList = lines.length > 0 && lines.every((line) => /^\s*[-*]\s+/.test(line));
        const isMarkdownTable =
          lines.length >= 2 &&
          /^\s*\|?(.+\|)+.+\|?\s*$/.test(lines[0]) &&
          /^\s*\|?[\s:-]+(\|[\s:-]+)+\|?\s*$/.test(lines[1]);

        if (isMarkdownTable) {
          const toCells = (line: string) =>
            line
              .trim()
              .replace(/^\|/, '')
              .replace(/\|$/, '')
              .split('|')
              .map((cell) => cell.trim());
          const headers = toCells(lines[0]);
          const rows = lines.slice(2).map(toCells);
          return (
            <div key={idx} className="overflow-x-auto rounded-lg border border-border bg-card/70">
              <table className="w-full min-w-[480px] text-xs">
                <thead>
                  <tr>
                    {headers.map((h, hIdx) => (
                      <th
                        key={hIdx}
                        className="border-b border-border px-2 py-1.5 text-left font-semibold text-muted-foreground"
                      >
                        {formatSummaryBoldInline(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIdx) => (
                    <tr key={rowIdx}>
                      {headers.map((_, colIdx) => (
                        <td key={colIdx} className="border-b border-border px-2 py-1.5 text-foreground/85">
                          {formatSummaryBoldInline(row[colIdx] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        if (isList) {
          return (
            <ul key={idx} className="ml-4 list-disc space-y-1">
              {lines.map((line, lineIdx) => (
                <li key={lineIdx}>{formatSummaryBoldInline(line.replace(/^\s*[-*]\s+/, ''))}</li>
              ))}
            </ul>
          );
        }

        if (/^###\s+/.test(trimmed)) {
          return (
            <h4 key={idx} className="text-sm font-semibold text-foreground">
              {formatSummaryBoldInline(trimmed.replace(/^###\s+/, ''))}
            </h4>
          );
        }
        if (/^##\s+/.test(trimmed)) {
          return (
            <h3 key={idx} className="text-base font-semibold text-foreground">
              {formatSummaryBoldInline(trimmed.replace(/^##\s+/, ''))}
            </h3>
          );
        }
        if (/^#\s+/.test(trimmed)) {
          return (
            <h2 key={idx} className="text-lg font-semibold text-foreground">
              {formatSummaryBoldInline(trimmed.replace(/^#\s+/, ''))}
            </h2>
          );
        }

        const inlineList = tryRenderInlineAsteriskList(trimmed, idx);
        if (inlineList) return inlineList;

        return (
          <p key={idx} className="text-sm leading-relaxed text-foreground/90">
            {formatSummaryBoldInline(trimmed)}
          </p>
        );
      })}
    </div>
  );
}

function formatSummaryBoldInline(text: string): (string | ReactElement)[] {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold text-foreground">
        {part}
      </strong>
    ) : (
      part
    )
  );
}
