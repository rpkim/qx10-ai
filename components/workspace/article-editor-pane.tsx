'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Eye, Loader2, Pencil, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useI18n } from '@/components/i18n-provider';
import { useWorkspace } from '@/lib/workspace-store';
import { useArticle } from '@/lib/article-store';
import { ArticleMarkdownView } from '@/components/workspace/article-markdown-view';
import {
  answerToMarkdown,
  countWords,
  dataNodeToMarkdown,
  type ArticleQaSource,
} from '@/lib/article-markdown';
import type { DataNodeData } from '@/lib/types';

export function ArticleEditorPane() {
  const { t } = useI18n();
  const { state, setBody, setMode, setSelection, insertMarkdown } = useArticle();
  const { draft, mode, seeding, caretRequest } = state;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [insertOpen, setInsertOpen] = useState(false);
  const appliedCaretRef = useRef(caretRequest.nonce);

  // Follow the stream while the seed draft is being written.
  useEffect(() => {
    if (!seeding) return;
    const el = textareaRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [seeding, draft.body]);

  // Restore the caret after the agent or the picker changed the body.
  useEffect(() => {
    if (caretRequest.nonce === appliedCaretRef.current) return;
    appliedCaretRef.current = caretRequest.nonce;
    if (mode !== 'edit') return;
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(caretRequest.position, caretRequest.position);
    el.scrollTop = el.scrollHeight * (caretRequest.position / Math.max(1, draft.body.length));
  }, [caretRequest, mode, draft.body.length]);

  const wordCount = useMemo(
    () => countWords(`${draft.title} ${draft.subtitle} ${draft.body}`),
    [draft.title, draft.subtitle, draft.body]
  );

  const syncSelection = () => {
    const el = textareaRef.current;
    if (el) setSelection(el.selectionStart, el.selectionEnd);
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2 sm:px-4">
        <div className="flex items-center rounded-xl border border-border bg-card/90 p-1">
          <button
            type="button"
            onClick={() => setMode('edit')}
            className={[
              'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
              mode === 'edit'
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground hover:text-foreground',
            ].join(' ')}
            aria-pressed={mode === 'edit'}
          >
            <Pencil className="size-3.5" />
            {t('article.editMode')}
          </button>
          <button
            type="button"
            onClick={() => setMode('preview')}
            className={[
              'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
              mode === 'preview'
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground hover:text-foreground',
            ].join(' ')}
            aria-pressed={mode === 'preview'}
          >
            <Eye className="size-3.5" />
            {t('article.previewMode')}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-muted-foreground sm:inline">
            {t('article.wordCount', { count: wordCount })}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => setInsertOpen(true)}
          >
            <Plus className="size-3.5" />
            {t('article.insertFromWorkspace')}
          </Button>
        </div>
      </div>

      {seeding && (
        <div className="flex shrink-0 items-center gap-2 border-b border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary sm:px-4">
          <Loader2 className="size-3.5 animate-spin" />
          {t('article.seeding')}
        </div>
      )}

      {mode === 'edit' ? (
        <textarea
          ref={textareaRef}
          value={draft.body}
          onChange={(e) => {
            setBody(e.target.value);
            setSelection(e.target.selectionStart, e.target.selectionEnd);
          }}
          onSelect={syncSelection}
          onClick={syncSelection}
          onKeyUp={syncSelection}
          readOnly={seeding}
          spellCheck={false}
          placeholder={t('article.bodyPlaceholder')}
          aria-label={t('article.studioTitle')}
          className="min-h-0 flex-1 resize-none bg-transparent px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] font-mono text-[13px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/60 sm:px-6"
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
          {draft.body.trim() ? (
            <ArticleMarkdownView markdown={draft.body} className="mx-auto max-w-3xl" />
          ) : (
            <p className="text-sm text-muted-foreground">{t('article.previewEmpty')}</p>
          )}
        </div>
      )}

      <InsertFromWorkspaceDialog
        open={insertOpen}
        onOpenChange={setInsertOpen}
        onInsert={(markdown, count) => {
          insertMarkdown(markdown, 'cursor');
          setInsertOpen(false);
          toast.success(t('article.insertDone', { count }));
        }}
      />
    </div>
  );
}

interface InsertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (markdown: string, count: number) => void;
}

function InsertFromWorkspaceDialog({ open, onOpenChange, onInsert }: InsertDialogProps) {
  const { t } = useI18n();
  const { state: workspace } = useWorkspace();
  const { qaSources } = useArticle();
  const [selected, setSelected] = useState<string[]>([]);

  const widgets = useMemo(
    () =>
      workspace.nodes.filter(
        (n): n is DataNodeData => n.type === 'data' && workspace.dashboardNodeIds.includes(n.id)
      ),
    [workspace.nodes, workspace.dashboardNodeIds]
  );

  useEffect(() => {
    if (!open) setSelected([]);
  }, [open]);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const buildMarkdown = (): string => {
    const blocks: string[] = [];
    for (const widget of widgets) {
      if (selected.includes(widget.id)) blocks.push(dataNodeToMarkdown(widget));
    }
    for (const source of qaSources) {
      if (selected.includes(source.answerId)) blocks.push(answerToMarkdown(source));
    }
    return blocks.join('\n\n');
  };

  const isEmpty = widgets.length === 0 && qaSources.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('article.insertDialogTitle')}</DialogTitle>
          <DialogDescription>{t('article.insertDialogDesc')}</DialogDescription>
        </DialogHeader>

        <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
          {isEmpty && <p className="text-sm text-muted-foreground">{t('article.insertEmpty')}</p>}

          {widgets.length > 0 && (
            <section className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground">
                {t('article.sectionPinned')}
              </p>
              {widgets.map((widget) => (
                <InsertRow
                  key={widget.id}
                  id={widget.id}
                  checked={selected.includes(widget.id)}
                  onToggle={toggle}
                  badge="D"
                  badgeClass="bg-amber-500/20 text-amber-600 dark:text-amber-300"
                  title={widget.title}
                  subtitle={widget.subtitle ?? widget.dataType}
                />
              ))}
            </section>
          )}

          {qaSources.length > 0 && (
            <section className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground">
                {t('article.sectionAnswers')}
              </p>
              {qaSources.map((source: ArticleQaSource) => (
                <InsertRow
                  key={source.answerId}
                  id={source.answerId}
                  checked={selected.includes(source.answerId)}
                  onToggle={toggle}
                  badge="A"
                  badgeClass="bg-lime-400/20 text-lime-600 dark:text-lime-300"
                  title={source.question}
                  subtitle={source.answer.slice(0, 120)}
                />
              ))}
            </section>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            disabled={selected.length === 0}
            onClick={() => onInsert(buildMarkdown(), selected.length)}
          >
            {t('article.insertSelected', { count: selected.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface InsertRowProps {
  id: string;
  checked: boolean;
  onToggle: (id: string) => void;
  badge: string;
  badgeClass: string;
  title: string;
  subtitle: string;
}

function InsertRow({ id, checked, onToggle, badge, badgeClass, title, subtitle }: InsertRowProps) {
  return (
    <label
      htmlFor={`insert-${id}`}
      className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-card/60 px-3 py-2.5 transition-colors hover:bg-secondary/60"
    >
      <Checkbox
        id={`insert-${id}`}
        checked={checked}
        onCheckedChange={() => onToggle(id)}
        className="mt-0.5"
      />
      <span
        className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded text-[10px] font-bold ${badgeClass}`}
      >
        {badge}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{title}</span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">{subtitle}</span>
      </span>
    </label>
  );
}
