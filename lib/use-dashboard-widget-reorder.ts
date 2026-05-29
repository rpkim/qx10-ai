'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import type { WorkspaceNode } from '@/lib/types';

export function useDashboardWidgetReorder(
  dashboardNodeIds: string[],
  pinnedNodes: WorkspaceNode[]
) {
  const [widgetOrder, setWidgetOrder] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  const compactDragRef = useRef<{ id: string; pointerId: number } | null>(null);
  const compactOverRef = useRef<string | null>(null);

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

  const reorderWidgets = useCallback(
    (dragId: string, overId: string) => {
      if (dragId === overId) return;
      const base = orderedIds.filter((id) => id !== dragId);
      const idx = base.indexOf(overId);
      if (idx < 0) return;
      base.splice(idx, 0, dragId);
      setWidgetOrder(base);
    },
    [orderedIds]
  );

  const handleCompactPointerDown = useCallback(
    (id: string) => (e: React.PointerEvent) => {
      if (e.button !== 0) return;

      const target = e.target as HTMLElement | null;
      if (!target?.closest('[data-dashboard-widget-header]')) return;
      if (target.closest('button,[role="button"],a,input,textarea,select')) return;

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
        if (overId && overId !== d.id) {
          reorderWidgets(d.id, overId);
        }
        setDragging(null);
        setDragOver(null);
      };

      window.addEventListener('pointermove', onMove, { passive: false });
      window.addEventListener('pointerup', onUp);
    },
    [reorderWidgets]
  );

  return {
    orderedIds,
    orderedNodes,
    dragging,
    dragOver,
    handleCompactPointerDown,
  };
}
