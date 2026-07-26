'use client';

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { toast } from 'sonner';
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  ListTree,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/components/i18n-provider';
import { useArticle } from '@/lib/article-store';
import {
  parseArticleOutline,
  serializeArticleOutline,
  type ArticleOutline,
  type ArticleOutlineItem,
} from '@/lib/article-markdown';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Position = { x: number; y: number };
type DragPath = { parent: number | null; index: number };

function createItem(level: 2 | 3): ArticleOutlineItem {
  return {
    id: `outline-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    level,
    title: '',
    content: '',
    children: [],
  };
}

function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length || from === to) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * Keep prose edits made in the editor while this floating window is open.
 * Outline ids represent each section's original location, so title/order edits
 * can be applied over the latest section content without losing new writing.
 */
function mergeLatestContent(edited: ArticleOutline, latest: ArticleOutline): ArticleOutline {
  const latestSections = new Map(latest.items.map((item) => [item.id, item]));
  return {
    preamble: latest.preamble,
    items: edited.items.map((item) => {
      const current = latestSections.get(item.id);
      const latestChildren = new Map(current?.children.map((child) => [child.id, child]) ?? []);
      return {
        ...item,
        content: current?.content ?? item.content,
        children: item.children.map((child) => ({
          ...child,
          content: latestChildren.get(child.id)?.content ?? child.content,
        })),
      };
    }),
  };
}

export function ArticleOutlineManager({ open, onOpenChange }: Props) {
  const { t } = useI18n();
  const { state, setBody } = useArticle();
  const [outline, setOutline] = useState<ArticleOutline>(() =>
    parseArticleOutline(state.draft.body)
  );
  const [baseline, setBaseline] = useState('');
  const [position, setPosition] = useState<Position>({ x: 56, y: 116 });
  const [movable, setMovable] = useState(false);
  const [dragging, setDragging] = useState<DragPath | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null);

  const resetFromArticle = () => {
    const parsed = parseArticleOutline(state.draft.body);
    setOutline(parsed);
    setBaseline(JSON.stringify(parsed));
  };

  useEffect(() => {
    if (open) resetFromArticle();
    // Opening is the synchronization boundary; body edits while open are preserved
    // until the user explicitly resets or applies the outline.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    const apply = () => setMovable(window.innerWidth >= 640);
    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, []);

  const dirty = useMemo(() => JSON.stringify(outline) !== baseline, [outline, baseline]);

  const clampPosition = (x: number, y: number): Position => {
    const panel = panelRef.current;
    const width = panel?.offsetWidth ?? 420;
    const height = panel?.offsetHeight ?? 560;
    return {
      x: Math.max(8, Math.min(x, window.innerWidth - Math.min(width, window.innerWidth) - 8)),
      y: Math.max(8, Math.min(y, window.innerHeight - Math.min(height, window.innerHeight) - 8)),
    };
  };

  const startWindowDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !movable) return;
    const target = event.target as HTMLElement;
    if (target.closest('button, input')) return;
    dragRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - position.x,
      offsetY: event.clientY - position.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveWindow = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setPosition(clampPosition(event.clientX - drag.offsetX, event.clientY - drag.offsetY));
  };

  const stopWindowDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const updateSection = (index: number, update: (item: ArticleOutlineItem) => ArticleOutlineItem) =>
    setOutline((current) => ({
      ...current,
      items: current.items.map((item, i) => (i === index ? update(item) : item)),
    }));

  const apply = () => {
    const latest = parseArticleOutline(state.draft.body);
    const merged = mergeLatestContent(outline, latest);
    const nextBody = serializeArticleOutline(merged);
    setBody(nextBody);
    setOutline(merged);
    setBaseline(JSON.stringify(merged));
    toast.success(t('article.outline.applied'));
  };

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-label={t('article.outline.title')}
      className="fixed inset-x-2 top-24 z-70 flex max-h-[calc(100vh-7rem)] flex-col overflow-hidden rounded-2xl border border-primary/30 bg-card/98 shadow-2xl backdrop-blur sm:inset-auto sm:w-107.5"
      style={movable ? { left: position.x, top: position.y } : undefined}
    >
      <div
        className="flex shrink-0 touch-none select-none items-start gap-3 border-b border-border px-3 py-3 sm:cursor-move"
        onPointerDown={startWindowDrag}
        onPointerMove={moveWindow}
        onPointerUp={stopWindowDrag}
        onPointerCancel={stopWindowDrag}
        title={t('article.outline.dragWindow')}
      >
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <ListTree className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">{t('article.outline.title')}</h2>
            {dirty && (
              <span className="size-2 rounded-full bg-amber-500" title={t('article.outline.unsaved')} />
            )}
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {t('article.outline.description')}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 text-muted-foreground"
          onClick={() => onOpenChange(false)}
          aria-label={t('common.close')}
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {outline.items.length === 0 && (
          <p className="rounded-xl border border-dashed border-border px-3 py-5 text-center text-xs text-muted-foreground">
            {t('article.outline.empty')}
          </p>
        )}

        {outline.items.map((section, sectionIndex) => (
          <div key={section.id} className="rounded-xl border border-border bg-background/80 p-2">
            <OutlineRow
              item={section}
              index={sectionIndex}
              count={outline.items.length}
              onTitle={(title) => updateSection(sectionIndex, (item) => ({ ...item, title }))}
              onMove={(direction) =>
                setOutline((current) => ({
                  ...current,
                  items: moveItem(
                    current.items,
                    sectionIndex,
                    sectionIndex + (direction === 'up' ? -1 : 1)
                  ),
                }))
              }
              onRemove={() =>
                setOutline((current) => ({
                  ...current,
                  items: current.items.filter((_, i) => i !== sectionIndex),
                }))
              }
              onDragStart={() => setDragging({ parent: null, index: sectionIndex })}
              onDrop={() => {
                if (dragging?.parent !== null) return;
                setOutline((current) => ({
                  ...current,
                  items: moveItem(current.items, dragging.index, sectionIndex),
                }));
                setDragging(null);
              }}
            />

            <div className="mt-1 space-y-1 border-l border-border pl-5">
              {section.children.map((child, childIndex) => (
                <OutlineRow
                  key={child.id}
                  item={child}
                  index={childIndex}
                  count={section.children.length}
                  nested
                  onTitle={(title) =>
                    updateSection(sectionIndex, (item) => ({
                      ...item,
                      children: item.children.map((nested, i) =>
                        i === childIndex ? { ...nested, title } : nested
                      ),
                    }))
                  }
                  onMove={(direction) =>
                    updateSection(sectionIndex, (item) => ({
                      ...item,
                      children: moveItem(
                        item.children,
                        childIndex,
                        childIndex + (direction === 'up' ? -1 : 1)
                      ),
                    }))
                  }
                  onRemove={() =>
                    updateSection(sectionIndex, (item) => ({
                      ...item,
                      children: item.children.filter((_, i) => i !== childIndex),
                    }))
                  }
                  onDragStart={() => setDragging({ parent: sectionIndex, index: childIndex })}
                  onDrop={() => {
                    if (dragging?.parent !== sectionIndex) return;
                    updateSection(sectionIndex, (item) => ({
                      ...item,
                      children: moveItem(item.children, dragging.index, childIndex),
                    }));
                    setDragging(null);
                  }}
                />
              ))}
              <button
                type="button"
                onClick={() =>
                  updateSection(sectionIndex, (item) => ({
                    ...item,
                    children: [...item.children, createItem(3)],
                  }))
                }
                className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <Plus className="size-3" />
                {t('article.outline.addSubsection')}
              </button>
            </div>
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-full gap-1.5 text-xs"
          onClick={() =>
            setOutline((current) => ({ ...current, items: [...current.items, createItem(2)] }))
          }
        >
          <Plus className="size-3.5" />
          {t('article.outline.addSection')}
        </Button>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border p-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-xs text-muted-foreground"
          onClick={resetFromArticle}
          disabled={!dirty}
        >
          <RotateCcw className="size-3.5" />
          {t('article.outline.reset')}
        </Button>
        <Button type="button" size="sm" className="h-8 text-xs" onClick={apply} disabled={!dirty}>
          {t('article.outline.apply')}
        </Button>
      </div>
    </div>
  );
}

interface OutlineRowProps {
  item: ArticleOutlineItem;
  index: number;
  count: number;
  nested?: boolean;
  onTitle: (title: string) => void;
  onMove: (direction: 'up' | 'down') => void;
  onRemove: () => void;
  onDragStart: () => void;
  onDrop: () => void;
}

function OutlineRow({
  item,
  index,
  count,
  nested,
  onTitle,
  onMove,
  onRemove,
  onDragStart,
  onDrop,
}: OutlineRowProps) {
  const { t } = useI18n();
  return (
    <div
      className="flex items-center gap-1"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        onDrop();
      }}
    >
      <span
        draggable
        className="shrink-0 cursor-grab text-muted-foreground/50 active:cursor-grabbing"
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = 'move';
          onDragStart();
        }}
      >
        <GripVertical className="size-3.5" aria-hidden />
      </span>
      <span className="w-5 shrink-0 text-center font-mono text-[10px] text-muted-foreground">
        {nested ? 'H3' : 'H2'}
      </span>
      <input
        value={item.title}
        onChange={(event) => onTitle(event.target.value)}
        placeholder={t('article.outline.sectionPlaceholder')}
        className="min-w-0 flex-1 rounded-md bg-transparent px-1.5 py-1 text-xs font-medium text-foreground outline-none focus:bg-secondary/60"
      />
      <button
        type="button"
        onClick={() => onMove('up')}
        disabled={index === 0}
        className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-25"
        aria-label={t('article.outline.moveUp')}
        title={t('article.outline.moveUp')}
      >
        <ChevronUp className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onMove('down')}
        disabled={index === count - 1}
        className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-25"
        aria-label={t('article.outline.moveDown')}
        title={t('article.outline.moveDown')}
      >
        <ChevronDown className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        aria-label={t('article.outline.remove')}
        title={t('article.outline.remove')}
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}
