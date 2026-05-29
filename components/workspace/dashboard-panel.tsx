'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { DataNodeData, AnswerNodeData, WorkspaceNode } from '@/lib/types';
import { useWorkspace } from '@/lib/workspace-store';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { LayoutGrid, Maximize2, Minimize2, Pencil, RefreshCw, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/components/i18n-provider';
import { GOAL_LABEL_KEYS } from '@/lib/i18n/goal-keys';
import {
  loadDashboardGridAsync,
  saveDashboardGrid,
  mergeLayoutWithPins,
  type DashboardGridItem,
} from '@/lib/dashboard-layout-storage';
import {
  fetchMarketQuotePayload,
  marketDataNodeRefreshSymbol,
} from '@/lib/market-data-node-refresh';
import { exportDashboardOnlyPdf, exportDashboardOnlyPng } from '@/lib/workspace-visual-export';
import { getClientTtsProvider } from '@/lib/tts/config';

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

interface Props {
  onClose: () => void;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
}

export function DashboardPanel({ onClose, expanded, onExpandedChange }: Props) {
  const { t } = useI18n();
  const { state, toggleDashboardPin } = useWorkspace();
  const { nodes, dashboardNodeIds, keyword, goal } = state;
  const [widgetOrder, setWidgetOrder] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [usePointerDnD, setUsePointerDnD] = useState(false);

  const [gridLayout, setGridLayout] = useState<DashboardGridItem[]>([]);
  const [editingGrid, setEditingGrid] = useState(false);
  const [compactHeights, setCompactHeights] = useState<Record<string, number>>({});
  const layoutBaselineRef = useRef<DashboardGridItem[] | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    id: string;
    ox: number;
    oy: number;
    px: number;
    py: number;
    w: number;
    h: number;
  } | null>(null);
  const resizeRef = useRef<{
    id: string;
    px: number;
    py: number;
    ox: number;
    oy: number;
    ow: number;
    oh: number;
  } | null>(null);
  const compactResizeRef = useRef<{
    id: string;
    startY: number;
    startH: number;
  } | null>(null);

  const pinnedNodes = nodes.filter((n) => dashboardNodeIds.includes(n.id));

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const touchCapable =
      'ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0;
    // HTML5 drag/drop is unreliable on mobile browsers.
    setUsePointerDnD(touchCapable);
  }, []);

  const orderedIds = useMemo(
    () => [
      ...widgetOrder.filter((id) => dashboardNodeIds.includes(id)),
      ...dashboardNodeIds.filter((id) => !widgetOrder.includes(id)),
    ],
    [widgetOrder, dashboardNodeIds]
  );

  const orderedNodes = useMemo(
    () =>
      orderedIds
        .map((id) => pinnedNodes.find((n) => n.id === id))
        .filter(Boolean) as WorkspaceNode[],
    [orderedIds, pinnedNodes]
  );

  const orderedIdsKey = orderedIds.join(',');
  const compactHeightsKey = `qx10.dashboard.compactHeights:${keyword}`;

  useEffect(() => {
    if (editingGrid) return;
    let cancelled = false;
    void loadDashboardGridAsync(keyword).then((saved) => {
      if (cancelled) return;
      setGridLayout(mergeLayoutWithPins(saved, orderedIds));
    });
    return () => {
      cancelled = true;
    };
  }, [keyword, orderedIdsKey, editingGrid]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(compactHeightsKey);
      if (!raw) {
        setCompactHeights({});
        return;
      }
      const parsed = JSON.parse(raw) as Record<string, number>;
      setCompactHeights(parsed ?? {});
    } catch {
      setCompactHeights({});
    }
  }, [compactHeightsKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(compactHeightsKey, JSON.stringify(compactHeights));
  }, [compactHeights, compactHeightsKey]);

  const startEditLayout = () => {
    layoutBaselineRef.current = gridLayout.map((x) => ({ ...x }));
    setEditingGrid(true);
  };

  const cancelEditLayout = () => {
    const b = layoutBaselineRef.current;
    if (b) setGridLayout(b.map((x) => ({ ...x })));
    layoutBaselineRef.current = null;
    setEditingGrid(false);
  };

  const saveEditLayout = () => {
    saveDashboardGrid(keyword, gridLayout);
    layoutBaselineRef.current = null;
    setEditingGrid(false);
    toast.success(t('dashboard.layoutSaved'));
  };

  const autoArrangeLayout = () => {
    const n = orderedIds.length;
    if (n === 0) return;
    const gap = 2;
    const cols = Math.min(5, Math.max(3, Math.ceil(Math.sqrt(n * 1.8))));
    const w = (100 - gap * (cols + 1)) / cols;
    const h = 22; // keep cards readable; container can scroll vertically when rows increase
    const arranged = orderedIds.map((id, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      return {
        id,
        x: gap + col * (w + gap),
        y: gap + row * (h + gap),
        w,
        h,
      } as DashboardGridItem;
    });
    setGridLayout(arranged);
    toast.success(t('dashboard.autoArrangeDone'));
  };

  const expandedGridHeightPct = useMemo(() => {
    const maxBottom = gridLayout.reduce((m, g) => Math.max(m, g.y + g.h), 0);
    return Math.max(100, Math.ceil(maxBottom + 2));
  }, [gridLayout]);

  const collapseExpanded = () => {
    if (editingGrid) cancelEditLayout();
    onExpandedChange(false);
  };

  const handleDragStart = (id: string) => setDragging(id);
  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    setDragOver(id);
  };
  const handleDrop = (targetId: string) => {
    if (!dragging || dragging === targetId) return;
    const base = orderedIds.filter((id) => id !== dragging);
    const idx = base.indexOf(targetId);
    base.splice(idx, 0, dragging);
    setWidgetOrder(base);
    setDragging(null);
    setDragOver(null);
  };
  const handleDragEnd = () => {
    setDragging(null);
    setDragOver(null);
  };

  const compactDragRef = useRef<{
    id: string;
    pointerId: number;
  } | null>(null);
  const compactOverRef = useRef<string | null>(null);

  const handleCompactPointerDown = (id: string) => (e: React.PointerEvent) => {
    if (!usePointerDnD) return;
    if (e.button !== 0) return;

    // Let buttons (pin/remove/etc) work normally.
    const target = e.target as HTMLElement | null;
    if (target?.closest('button,[role="button"],a,input,textarea,select')) return;

    e.preventDefault();
    e.stopPropagation();

    compactDragRef.current = { id, pointerId: e.pointerId };
    setDragging(id);
    setDragOver(id);
    compactOverRef.current = id;

    const onMove = (ev: PointerEvent) => {
      if (!compactDragRef.current) return;
      const el = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null;
      const widgetEl = el?.closest('[data-dashboard-compact-widget-id]') as HTMLElement | null;
      const overId = widgetEl?.dataset.dashboardCompactWidgetId ?? null;
      compactOverRef.current = overId;
      setDragOver(overId);
    };

    const onUp = () => {
      const d = compactDragRef.current;
      compactDragRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (!d) return;
      const overId = compactOverRef.current;
      if (!overId || overId === d.id) {
        setDragging(null);
        setDragOver(null);
        return;
      }
      const base = orderedIds.filter((x) => x !== d.id);
      const idx = base.indexOf(overId);
      if (idx < 0) {
        setDragging(null);
        setDragOver(null);
        return;
      }
      base.splice(idx, 0, d.id);
      setWidgetOrder(base);
      setDragging(null);
      setDragOver(null);
    };

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
  };

  const handleExport = () => {
    const data = orderedNodes.map((n) => ({
      type: n.type,
      title: n.type === 'answer' ? 'Answer' : (n as DataNodeData).title,
      content: n.type === 'answer' ? (n as AnswerNodeData).content : undefined,
      keywords: n.type === 'answer' ? (n as AnswerNodeData).extractedKeywords : undefined,
    }));
    const blob = new Blob([JSON.stringify({ keyword, goal, widgets: data }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qx10-dashboard-${keyword.replace(/\s+/g, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportDashboardPng = () => {
    void exportDashboardOnlyPng(keyword)
      .then(() => toast.success(t('dashboard.exportPngDone')))
      .catch(() => toast.error(t('dashboard.exportImageFail')));
  };

  const handleExportDashboardPdf = () => {
    void exportDashboardOnlyPdf(keyword)
      .then(() => toast.success(t('dashboard.exportPdfDone')))
      .catch(() => toast.error(t('dashboard.exportImageFail')));
  };

  const onHeaderPointerDown = useCallback(
    (id: string) => (e: React.PointerEvent) => {
      if (!editingGrid || !boardRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      const item = gridLayout.find((l) => l.id === id);
      if (!item) return;
      dragRef.current = {
        id,
        ox: item.x,
        oy: item.y,
        px: e.clientX,
        py: e.clientY,
        w: item.w,
        h: item.h,
      };

      const onMove = (ev: PointerEvent) => {
        const d = dragRef.current;
        const board = boardRef.current;
        if (!d || !board) return;
        const rect = board.getBoundingClientRect();
        const dx = ((ev.clientX - d.px) / rect.width) * 100;
        const dy = ((ev.clientY - d.py) / rect.height) * 100;
        setGridLayout((prev) =>
          prev.map((it) =>
            it.id === d.id
              ? {
                  ...it,
                  x: clamp(d.ox + dx, 0, 100 - d.w),
                  y: clamp(d.oy + dy, 0, 100 - d.h),
                }
              : it
          )
        );
      };

      const onUp = () => {
        dragRef.current = null;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [editingGrid, gridLayout]
  );

  const onResizePointerDown = useCallback(
    (id: string) => (e: React.PointerEvent) => {
      if (!editingGrid || !boardRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      const item = gridLayout.find((l) => l.id === id);
      if (!item) return;
      resizeRef.current = {
        id,
        px: e.clientX,
        py: e.clientY,
        ox: item.x,
        oy: item.y,
        ow: item.w,
        oh: item.h,
      };

      const onMove = (ev: PointerEvent) => {
        const r = resizeRef.current;
        const board = boardRef.current;
        if (!r || !board) return;
        const rect = board.getBoundingClientRect();
        const dw = ((ev.clientX - r.px) / rect.width) * 100;
        const dh = ((ev.clientY - r.py) / rect.height) * 100;
        setGridLayout((prev) =>
          prev.map((it) => {
            if (it.id !== r.id) return it;
            const minW = 16;
            const minH = 14;
            const maxW = 100 - r.ox;
            const maxH = 100 - r.oy;
            return {
              ...it,
              w: clamp(r.ow + dw, minW, maxW),
              h: clamp(r.oh + dh, minH, maxH),
            };
          })
        );
      };

      const onUp = () => {
        resizeRef.current = null;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [editingGrid, gridLayout]
  );

  const onCompactResizePointerDown = useCallback(
    (id: string) => (e: React.PointerEvent) => {
      if (expanded) return;
      e.preventDefault();
      e.stopPropagation();

      const current = compactHeights[id] ?? 280;
      compactResizeRef.current = {
        id,
        startY: e.clientY,
        startH: current,
      };

      const onMove = (ev: PointerEvent) => {
        const r = compactResizeRef.current;
        if (!r) return;
        const dy = ev.clientY - r.startY;
        const next = clamp(r.startH + dy, 180, 760);
        setCompactHeights((prev) => ({ ...prev, [r.id]: next }));
      };

      const onUp = () => {
        compactResizeRef.current = null;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [expanded, compactHeights]
  );

  const shellClass = expanded
    ? 'fixed inset-x-0 bottom-0 top-20 z-30 flex flex-col border-t border-border bg-card sm:top-24'
    : 'absolute right-0 bottom-0 top-20 z-30 flex w-full max-w-[480px] flex-col border-l border-border bg-card sm:top-24';

  return (
    <div className={shellClass}>
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3 sm:px-5 sm:py-4">
        <div className="min-w-0 flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00C49A" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            <h2
              className="truncate text-base font-bold text-foreground"
              style={{ fontFamily: 'var(--font-space-grotesk)' }}
            >
              {t('toolbar.dashboard')}
            </h2>
            {pinnedNodes.length > 0 && (
              <span
                className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full px-1.5 text-xs font-bold"
                style={{ background: 'rgba(0,196,154,0.15)', color: '#00C49A' }}
              >
                {pinnedNodes.length}
              </span>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {keyword}
            <span
              className="ml-1.5 rounded-full px-1.5 py-0.5"
              style={{ background: 'rgba(0,196,154,0.1)', color: '#00C49A' }}
            >
              {t(GOAL_LABEL_KEYS[goal])}
            </span>
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
          {expanded && (
            <>
              {!editingGrid ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1 text-xs"
                  onClick={startEditLayout}
                >
                  <Pencil className="size-3.5" />
                  {t('dashboard.edit')}
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1 text-xs"
                    onClick={autoArrangeLayout}
                  >
                    <LayoutGrid className="size-3.5" />
                    {t('dashboard.autoArrange')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1 text-xs"
                    onClick={cancelEditLayout}
                  >
                    <X className="size-3.5" />
                    {t('common.cancel')}
                  </Button>
                  <Button type="button" size="sm" className="h-8 gap-1 text-xs" onClick={saveEditLayout}>
                    <Save className="size-3.5" />
                    {t('common.save')}
                  </Button>
                </>
              )}
            </>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 text-muted-foreground"
            title={expanded ? t('dashboard.shrinkPanel') : t('dashboard.expandPanel')}
            onClick={() => {
              if (expanded) {
                collapseExpanded();
              } else {
                onExpandedChange(true);
              }
            }}
          >
            {expanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </Button>
          {pinnedNodes.length > 0 && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="hidden h-8 text-xs sm:inline-flex"
                onClick={handleExportDashboardPng}
              >
                {t('dashboard.exportPng')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="hidden h-8 text-xs sm:inline-flex"
                onClick={handleExportDashboardPdf}
              >
                {t('dashboard.exportPdf')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="hidden h-8 text-xs sm:inline-flex"
                onClick={handleExport}
              >
                {t('dashboard.export')}
              </Button>
            </>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 text-muted-foreground"
            onClick={onClose}
            aria-label={t('common.close')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </Button>
        </div>
      </div>

      {expanded && editingGrid && (
        <div className="shrink-0 border-b border-dashed border-primary/30 bg-primary/5 px-4 py-2 text-center text-xs text-muted-foreground">
          {t('dashboard.editHint')}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {orderedNodes.length === 0 ? (
          <div id="dashboard-export-target" className="flex-1 overflow-y-auto">
            <EmptyState />
          </div>
        ) : expanded ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-auto p-3 sm:p-4">
            <div
              id="dashboard-export-target"
              ref={boardRef}
              className={[
                'relative min-h-[min(70vh,720px)] rounded-2xl border bg-background/40',
                editingGrid ? 'border-dashed border-primary/40' : 'border-border',
              ].join(' ')}
              style={{
                minHeight: `${expandedGridHeightPct}%`,
                ...(editingGrid
                  ? {
                      backgroundImage:
                        'linear-gradient(to right, rgba(0,196,154,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,196,154,0.06) 1px, transparent 1px)',
                      backgroundSize: '24px 24px',
                    }
                  : {}),
              }}
            >
              {orderedNodes.map((node) => {
                const box = gridLayout.find((g) => g.id === node.id);
                if (!box) return null;
                return (
                  <div
                    key={node.id}
                    data-dashboard-export-item="true"
                    className={[
                      'absolute overflow-hidden rounded-2xl border border-border bg-card shadow-sm',
                      editingGrid ? 'ring-1 ring-primary/20 shadow-lg' : '',
                    ].join(' ')}
                    style={{
                      left: `${box.x}%`,
                      top: `${box.y}%`,
                      width: `${box.w}%`,
                      height: `${box.h}%`,
                    }}
                  >
                    <DashboardWidget
                      node={node}
                      onUnpin={() => toggleDashboardPin(node.id)}
                      compact={false}
                      editMode={editingGrid}
                      onHeaderPointerDown={onHeaderPointerDown(node.id)}
                    />
                    {editingGrid && (
                      <button
                        type="button"
                        onPointerDown={onResizePointerDown(node.id)}
                        className="absolute bottom-1.5 right-1.5 z-20 flex h-5 w-5 items-center justify-center rounded-md border border-primary/40 bg-background/90 text-primary shadow-sm"
                        title="Resize widget"
                        aria-label="Resize widget"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M7 17 17 7M13 17h4v-4" />
                        </svg>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div id="dashboard-export-target" className="flex flex-col gap-3 p-4">
              {pinnedNodes.length > 1 && (
                <p className="text-xs text-muted-foreground/60">{t('dashboard.dragReorder')}</p>
              )}
              {orderedNodes.map((node) => (
                <div
                  key={node.id}
                  data-dashboard-export-item="true"
                  data-dashboard-compact-widget-id={node.id}
                  draggable={!usePointerDnD}
                  onDragStart={!usePointerDnD ? () => handleDragStart(node.id) : undefined}
                  onDragOver={
                    !usePointerDnD ? (e) => handleDragOver(e, node.id) : undefined
                  }
                  onDrop={!usePointerDnD ? () => handleDrop(node.id) : undefined}
                  onDragEnd={!usePointerDnD ? handleDragEnd : undefined}
                  onPointerDown={usePointerDnD ? handleCompactPointerDown(node.id) : undefined}
                  style={{
                    opacity: dragging === node.id ? 0.4 : 1,
                    touchAction: usePointerDnD ? 'none' : undefined,
                    outline:
                      dragOver === node.id && dragging !== node.id
                        ? '2px solid rgba(0,196,154,0.6)'
                        : 'none',
                    borderRadius: '16px',
                    transition: 'opacity 0.15s, outline 0.1s',
                    position: 'relative',
                    height: compactHeights[node.id] ? `${compactHeights[node.id]}px` : undefined,
                  }}
                >
                  <DashboardWidget
                    node={node}
                    onUnpin={() => toggleDashboardPin(node.id)}
                    compact
                    disableCompactHeightCap
                  />
                  <button
                    type="button"
                    onPointerDown={onCompactResizePointerDown(node.id)}
                    className="absolute bottom-2 right-2 z-20 flex h-5 w-5 items-center justify-center rounded-md border border-primary/40 bg-background/90 text-primary shadow-sm"
                    title="Resize widget"
                    aria-label="Resize widget"
                    onClick={(e) => e.preventDefault()}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M7 17 17 7M13 17h4v-4" />
                    </svg>
                  </button>
                </div>
              ))}

              <div
                className="mt-1 rounded-2xl border p-4"
                style={{ borderColor: 'rgba(0,196,154,0.12)', background: 'rgba(0,196,154,0.03)' }}
              >
                <p className="mb-2 text-xs font-semibold text-muted-foreground">{t('dashboard.summary')}</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: t('dashboard.widgets'), value: pinnedNodes.length },
                    { label: t('dashboard.answers'), value: pinnedNodes.filter((n) => n.type === 'answer').length },
                    { label: t('dashboard.data'), value: pinnedNodes.filter((n) => n.type === 'data').length },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className="flex flex-col items-center gap-0.5 rounded-xl py-2"
                      style={{ background: 'rgba(0,0,0,0.2)' }}
                    >
                      <span
                        className="text-xl font-bold"
                        style={{ fontFamily: 'var(--font-space-grotesk)', color: '#00C49A' }}
                      >
                        {s.value}
                      </span>
                      <span className="text-xs text-muted-foreground">{s.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center justify-center gap-5 px-6 py-16 text-center">
      <div
        className="flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{ background: 'rgba(0,196,154,0.08)', border: '1px solid rgba(0,196,154,0.2)' }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00C49A" strokeWidth="1.5">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      </div>
      <div>
        <p className="font-semibold text-foreground">{t('dashboard.emptyTitle')}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t('dashboard.emptyDesc')}</p>
      </div>
      <div className="flex w-full flex-col gap-3 rounded-2xl border border-border bg-secondary px-4 py-4 text-left">
        <p className="text-xs font-semibold text-foreground">{t('dashboard.howToTitle')}</p>
        {[
          { step: '1', text: t('dashboard.step1') },
          { step: '2', text: t('dashboard.step2') },
          { step: '3', text: t('dashboard.step3') },
        ].map((s) => (
          <div key={s.step} className="flex items-center gap-3">
            <span
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold"
              style={{ background: 'rgba(0,196,154,0.15)', color: '#00C49A' }}
            >
              {s.step}
            </span>
            <span className="text-xs text-muted-foreground">{s.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardWidget({
  node,
  onUnpin,
  compact,
  editMode,
  onHeaderPointerDown,
  /** When false (e.g. mobile stack), cap widget height so body scrolls inside. */
  disableCompactHeightCap = false,
}: {
  node: WorkspaceNode;
  onUnpin: () => void;
  compact: boolean;
  editMode?: boolean;
  onHeaderPointerDown?: (e: React.PointerEvent) => void;
  disableCompactHeightCap?: boolean;
}) {
  const { t } = useI18n();
  const { dispatch } = useWorkspace();
  const [collapsed, setCollapsed] = useState(false);
  const [dataRefreshing, setDataRefreshing] = useState(false);

  const title = node.type === 'answer' ? t('nodes.answer') : (node as DataNodeData).title;
  const dataRefreshSymbol =
    node.type === 'data' ? marketDataNodeRefreshSymbol(node as DataNodeData) : null;

  const refreshDataWidget = async () => {
    if (!dataRefreshSymbol || dataRefreshing) return;
    setDataRefreshing(true);
    try {
      const payload = await fetchMarketQuotePayload(dataRefreshSymbol);
      if (!payload) {
        toast.error(t('dashboard.dataRefreshFail'));
        return;
      }
      dispatch({
        type: 'UPDATE_NODE',
        id: node.id,
        updates: payload as Partial<DataNodeData>,
      });
      toast.success(t('dashboard.dataRefreshDone'));
    } finally {
      setDataRefreshing(false);
    }
  };
  const badge =
    node.type === 'answer'
      ? { bg: 'rgba(163,230,53,0.15)', color: '#A3E635', label: 'A' }
      : { bg: 'rgba(245,158,11,0.15)', color: '#F59E0B', label: 'D' };

  return (
    <div
      className={[
        'flex min-h-0 flex-col overflow-hidden rounded-2xl',
        compact && !disableCompactHeightCap
          ? 'max-h-[min(70vh,520px)] min-h-[10rem]'
          : 'h-full',
        compact && disableCompactHeightCap ? 'min-h-[10rem]' : '',
      ].join(' ')}
      style={{ background: 'rgba(255,255,255,0.015)' }}
    >
      <div
        className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2.5 sm:px-4 sm:py-3"
        onPointerDown={editMode ? onHeaderPointerDown : undefined}
        style={{
          cursor: editMode ? 'move' : compact ? 'grab' : 'default',
          borderBottom: collapsed ? 'none' : undefined,
        }}
      >
        <div className="flex min-w-0 items-center gap-2">
          {compact && (
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="shrink-0 text-muted-foreground/40"
            >
              <circle cx="9" cy="5" r="1" fill="currentColor" />
              <circle cx="15" cy="5" r="1" fill="currentColor" />
              <circle cx="9" cy="12" r="1" fill="currentColor" />
              <circle cx="15" cy="12" r="1" fill="currentColor" />
              <circle cx="9" cy="19" r="1" fill="currentColor" />
              <circle cx="15" cy="19" r="1" fill="currentColor" />
            </svg>
          )}
          {editMode && (
            <span className="text-[10px] font-medium uppercase tracking-wide text-primary/80">
              {t('dashboard.dragBadge')}
            </span>
          )}
          <span
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold"
            style={{ background: badge.bg, color: badge.color }}
          >
            {badge.label}
          </span>
          <span
            className={[
              'min-w-0 text-sm font-medium text-foreground',
              compact ? 'line-clamp-2 break-words' : 'truncate',
            ].join(' ')}
          >
            {title}
          </span>
        </div>
        <div
          className="flex shrink-0 items-center gap-1"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {dataRefreshSymbol && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void refreshDataWidget();
              }}
              disabled={dataRefreshing}
              className="rounded-lg p-1.5 text-muted-foreground/60 transition-colors hover:text-foreground disabled:opacity-50"
              title={t('dashboard.dataRefresh')}
            >
              <RefreshCw className={`size-3.5 ${dataRefreshing ? 'animate-spin' : ''}`} />
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setCollapsed((v) => !v);
            }}
            className="rounded-lg p-1.5 text-muted-foreground/60 transition-colors hover:text-foreground"
            title={collapsed ? t('dashboard.expandWidget') : t('dashboard.collapseWidget')}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              style={{
                transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s',
              }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onUnpin();
            }}
            className="rounded-lg p-1.5 text-muted-foreground/60 transition-colors hover:text-destructive"
            title={t('dashboard.removeWidget')}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {!collapsed && (
        <div
          className={[
            'min-h-0 flex-1 overflow-y-auto px-3 py-2 sm:px-4 sm:py-3',
            compact ? '' : 'text-sm',
          ].join(' ')}
        >
          {node.type === 'answer' && <AnswerWidget node={node as AnswerNodeData} compact={compact} />}
          {node.type === 'data' && <DataWidget node={node as DataNodeData} compact={compact} />}
        </div>
      )}
    </div>
  );
}

function AnswerWidget({ node, compact }: { node: AnswerNodeData; compact: boolean }) {
  const { t, locale } = useI18n();
  const { refreshAnswerMetadata, isDemoMode } = useWorkspace();
  const [expanded, setExpanded] = useState(false);
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const [metaRefreshing, setMetaRefreshing] = useState(false);
  const browserUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ttsProvider = getClientTtsProvider();
  /** Compact dashboard cards: allow more text before "show more" (mobile-friendly). */
  const limit = compact ? 1400 : 2000;
  const preview = node.content.slice(0, limit);
  const isTruncated = node.content.length > limit;
  const rendered = (expanded ? node.content : preview).split('\n\n').map((para, i) => (
    <p
      key={i}
      className={[
        'mb-2 last:mb-0 leading-relaxed text-foreground/80',
        compact ? 'text-[13px]' : 'text-xs',
      ].join(' ')}
    >
      {formatBold(para)}
    </p>
  ));

  useEffect(() => {
    return () => {
      if (browserUtteranceRef.current && typeof window !== 'undefined') {
        window.speechSynthesis.cancel();
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const stopTts = () => {
    if (ttsProvider === 'browser' && typeof window !== 'undefined') {
      window.speechSynthesis.cancel();
      browserUtteranceRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setTtsPlaying(false);
  };

  const playTts = async () => {
    const text = node.content.trim();
    if (!text) return;
    if (ttsPlaying) {
      stopTts();
      return;
    }
    if (ttsProvider === 'browser') {
      if (typeof window === 'undefined' || !window.speechSynthesis) return;
      const utterance = new SpeechSynthesisUtterance(text.slice(0, 900));
      utterance.lang =
        locale === 'ko'
          ? 'ko-KR'
          : locale === 'ja'
            ? 'ja-JP'
            : locale === 'zh'
              ? 'zh-CN'
              : locale === 'es'
                ? 'es-ES'
                : 'en-US';
      utterance.onend = () => setTtsPlaying(false);
      utterance.onerror = () => setTtsPlaying(false);
      browserUtteranceRef.current = utterance;
      setTtsPlaying(true);
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
      return;
    }
    try {
      setTtsPlaying(true);
      const prep = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.slice(0, 900) }),
      });
      if (!prep.ok) {
        setTtsPlaying(false);
        return;
      }
      const prepJson = (await prep.json().catch(() => ({}))) as { streamUrl?: string };
      if (!prepJson.streamUrl) {
        setTtsPlaying(false);
        return;
      }
      const audio = new Audio(prepJson.streamUrl);
      audioRef.current = audio;
      audio.onended = () => {
        setTtsPlaying(false);
        audioRef.current = null;
      };
      audio.onerror = () => {
        setTtsPlaying(false);
        audioRef.current = null;
      };
      await audio.play();
    } catch {
      setTtsPlaying(false);
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void playTts()}
          className="flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs transition-colors"
          style={{
            color: ttsPlaying ? '#00C49A' : 'var(--muted-foreground)',
            borderColor: 'rgba(163,230,53,0.25)',
            background: ttsPlaying ? 'rgba(0,196,154,0.1)' : 'rgba(255,255,255,0.02)',
          }}
        >
          {ttsPlaying ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <rect x="5" y="4" width="5" height="16" rx="1" />
              <rect x="14" y="4" width="5" height="16" rx="1" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="6,4 20,12 6,20" />
            </svg>
          )}
          <span>{ttsPlaying ? t('nodes.ttsStop') : t('nodes.ttsPlay')}</span>
        </button>
        {!isDemoMode && (
          <button
            type="button"
            disabled={metaRefreshing}
            onClick={() => {
              setMetaRefreshing(true);
              void refreshAnswerMetadata(node.id).finally(() => setMetaRefreshing(false));
            }}
            className="flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs transition-colors disabled:opacity-50"
            style={{
              color: 'var(--muted-foreground)',
              borderColor: 'rgba(163,230,53,0.25)',
              background: 'rgba(255,255,255,0.02)',
            }}
            title={t('nodes.refreshKeywords')}
          >
            <RefreshCw className={`size-3 ${metaRefreshing ? 'animate-spin' : ''}`} aria-hidden />
            <span>{t('nodes.refreshKeywordsShort')}</span>
          </button>
        )}
      </div>
      <div
        className={
          compact
            ? 'max-h-[min(52vh,440px)] overflow-y-auto overscroll-y-contain pr-1 [scrollbar-width:thin]'
            : 'min-w-0'
        }
      >
        {rendered}
        {isTruncated && !expanded && (
          <span className="text-xs leading-relaxed text-foreground/70">...</span>
        )}
      </div>
      {isTruncated && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="self-start text-xs text-primary/70 transition-colors hover:text-primary"
        >
          {expanded ? t('dashboard.showLess') : t('dashboard.showMore')}
        </button>
      )}
      {node.extractedKeywords.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {node.extractedKeywords.map((kw) => (
            <span
              key={kw}
              className="rounded-full border px-2 py-0.5 text-xs"
              style={{ borderColor: 'rgba(163,230,53,0.2)', color: '#A3E635' }}
            >
              {kw}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function formatBold(text: string): React.ReactNode[] {
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

function DataWidget({ node, compact }: { node: DataNodeData; compact: boolean }) {
  const chartH = compact ? 140 : 200;
  return (
    <div className="min-w-0 overflow-x-hidden">
      {node.subtitle && (
        <p className="mb-2 min-w-0 break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
          {node.subtitle}
        </p>
      )}
      {node.dataType === 'bar-chart' && node.chartData && (
        <ResponsiveContainer width="100%" height={chartH}>
          <BarChart data={node.chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <XAxis
              dataKey="label"
              tick={{ fill: 'rgba(148,163,184,0.7)', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis tick={{ fill: 'rgba(148,163,184,0.7)', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{
                background: '#0F1623',
                border: '1px solid rgba(245,158,11,0.3)',
                borderRadius: 8,
                fontSize: 11,
              }}
              labelStyle={{ color: '#E2E8F0' }}
              itemStyle={{ color: '#F59E0B' }}
            />
            <Bar dataKey="value" fill="#F59E0B" fillOpacity={0.85} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
      {node.dataType === 'line-chart' && node.chartData && (
        <ResponsiveContainer width="100%" height={chartH}>
          <LineChart data={node.chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <XAxis
              dataKey="label"
              tick={{ fill: 'rgba(148,163,184,0.7)', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis tick={{ fill: 'rgba(148,163,184,0.7)', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{
                background: '#0F1623',
                border: '1px solid rgba(0,196,154,0.3)',
                borderRadius: 8,
                fontSize: 11,
              }}
              labelStyle={{ color: '#E2E8F0' }}
            />
            <Line type="monotone" dataKey="value" stroke="#00C49A" strokeWidth={2} dot={false} name="Strategy" />
            {node.chartData[0]?.value2 !== undefined && (
              <Line
                type="monotone"
                dataKey="value2"
                stroke="#F59E0B"
                strokeWidth={1.5}
                strokeDasharray="4 2"
                dot={false}
                name="Benchmark"
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      )}
      {node.dataType === 'table' && node.tableRows && (
        <div
          className="max-h-[min(56vh,480px)] min-w-0 overflow-x-auto overflow-y-auto overscroll-y-contain rounded-xl [scrollbar-width:thin]"
          style={{ background: 'rgba(0,0,0,0.2)' }}
        >
          <table className="w-full min-w-0 table-fixed text-xs">
            <thead>
              <tr>
                {node.tableColumns?.map((col) => (
                  <th
                    key={col}
                    className="min-w-0 max-w-0 border-b px-2 py-2 text-left align-top font-semibold break-words text-muted-foreground [overflow-wrap:anywhere] sm:px-3"
                    style={{ borderColor: 'rgba(245,158,11,0.12)' }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {node.tableRows.map((row, i) => (
                <tr key={i} className="transition-colors hover:bg-white/2">
                  {node.tableColumns?.map((col) => (
                    <td
                      key={col}
                      className="min-w-0 max-w-0 border-b px-2 py-2 align-top break-words text-foreground/80 [overflow-wrap:anywhere] sm:px-3"
                      style={{ borderColor: 'rgba(245,158,11,0.06)' }}
                    >
                      {String(row[col] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {node.dataType === 'list' && node.listItems && (
        <ul className="flex min-w-0 flex-col gap-1.5">
          {node.listItems.map((item, i) => (
            <li
              key={i}
              className={[
                'flex min-w-0 items-start gap-2 text-foreground/80',
                compact ? 'text-[13px] leading-snug' : 'text-xs',
              ].join(' ')}
            >
              <span
                className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
                style={{ background: 'rgba(245,158,11,0.2)', color: '#F59E0B' }}
              >
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 [overflow-wrap:anywhere] break-words">{item}</span>
            </li>
          ))}
        </ul>
      )}
      {node.dataType === 'metric' && node.metrics && (
        <div className="grid grid-cols-2 gap-2">
          {node.metrics.map((m) => (
            <div key={m.label} className="flex flex-col gap-1 rounded-xl p-3" style={{ background: 'rgba(0,0,0,0.2)' }}>
              <span className="text-xs text-muted-foreground">{m.label}</span>
              <span
                className="text-xl font-bold"
                style={{ fontFamily: 'var(--font-space-grotesk)', color: m.up ? '#00C49A' : '#F59E0B' }}
              >
                {m.value}
              </span>
              {m.change && <span className="text-xs text-muted-foreground">{m.change}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
