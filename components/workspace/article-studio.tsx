'use client';

import { useEffect, useState } from 'react';
import { Download, FileText, ListTree, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { useI18n } from '@/components/i18n-provider';
import { ArticleProvider, useArticle } from '@/lib/article-store';
import { ArticleEditorPane } from '@/components/workspace/article-editor-pane';
import { ArticleAgentPane } from '@/components/workspace/article-agent-pane';
import { ArticleOutlineManager } from '@/components/workspace/article-outline-manager';

interface Props {
  onClose: () => void;
}

/** Two panes only fit comfortably from this width up; below it they become tabs. */
const SPLIT_BREAKPOINT = 1024;

export function ArticleStudio({ onClose }: Props) {
  return (
    <ArticleProvider>
      <ArticleStudioShell onClose={onClose} />
    </ArticleProvider>
  );
}

function ArticleStudioShell({ onClose }: Props) {
  const { t } = useI18n();
  const { state, setTitle, setSubtitle, regenerateDraft, downloadMarkdown } = useArticle();
  const { draft, seeding, chatting } = state;
  const [split, setSplit] = useState(true);
  const [mobileTab, setMobileTab] = useState<'editor' | 'agent'>('editor');
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(false);

  useEffect(() => {
    const apply = () => setSplit(window.innerWidth >= SPLIT_BREAKPOINT);
    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // A nested dialog (insert picker, confirm) owns Escape while it is open.
      if (document.querySelector('[role="dialog"][data-state="open"]')) return;
      onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const hasContent = draft.body.trim().length > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('article.studioTitle')}
      className="fixed inset-0 z-50 flex flex-col bg-background"
    >
      <header className="shrink-0 border-b border-border px-3 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] sm:px-5 sm:py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <FileText className="size-4 shrink-0 text-primary" />
              <span
                className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                style={{ fontFamily: 'var(--font-space-grotesk)' }}
              >
                {t('article.studioTitle')}
              </span>
              {!seeding && hasContent && (
                <span className="hidden text-[11px] text-muted-foreground/70 sm:inline">
                  · {t('article.autosaved')}
                </span>
              )}
            </div>
            <input
              value={draft.title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('article.titlePlaceholder')}
              aria-label={t('article.titlePlaceholder')}
              className="w-full truncate bg-transparent text-lg font-bold text-foreground outline-none placeholder:text-muted-foreground/50 sm:text-xl"
              style={{ fontFamily: 'var(--font-space-grotesk)' }}
            />
            <input
              value={draft.subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder={t('article.subtitlePlaceholder')}
              aria-label={t('article.subtitlePlaceholder')}
              className="mt-0.5 w-full truncate bg-transparent text-sm text-muted-foreground outline-none placeholder:text-muted-foreground/50"
            />
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              type="button"
              variant={outlineOpen ? 'default' : 'outline'}
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => setOutlineOpen((value) => !value)}
              disabled={seeding || !hasContent}
              title={t('article.outline.open')}
              aria-pressed={outlineOpen}
            >
              <ListTree className="size-3.5" />
              <span className="hidden sm:inline">{t('article.outline.open')}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => setRegenerateOpen(true)}
              disabled={seeding || chatting}
              title={t('article.regenerate')}
            >
              <RefreshCw className={`size-3.5 ${seeding ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{t('article.regenerate')}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={downloadMarkdown}
              disabled={!hasContent}
              title={t('article.download')}
            >
              <Download className="size-3.5" />
              <span className="hidden sm:inline">{t('article.download')}</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground"
              onClick={onClose}
              aria-label={t('common.close')}
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {!split && (
          <div className="mt-2 flex items-center rounded-xl border border-border bg-card/90 p-1">
            {(['editor', 'agent'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setMobileTab(tab)}
                className={[
                  'flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                  mobileTab === tab
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                ].join(' ')}
                aria-pressed={mobileTab === tab}
              >
                {tab === 'editor' ? t('article.tabEditor') : t('article.tabAgent')}
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="min-h-0 flex-1">
        {split ? (
          <ResizablePanelGroup direction="horizontal">
            <ResizablePanel defaultSize={62} minSize={35}>
              <ArticleEditorPane />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={38} minSize={25}>
              <ArticleAgentPane />
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          <div className="h-full">
            {mobileTab === 'editor' ? <ArticleEditorPane /> : <ArticleAgentPane />}
          </div>
        )}
      </div>

      <AlertDialog open={regenerateOpen} onOpenChange={setRegenerateOpen}>
        <AlertDialogContent className="border-border sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('article.regenerateTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('article.regenerateDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setRegenerateOpen(false);
                regenerateDraft();
              }}
            >
              {t('article.regenerateConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <ArticleOutlineManager open={outlineOpen} onOpenChange={setOutlineOpen} />
    </div>
  );
}
