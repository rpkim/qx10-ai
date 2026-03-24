'use client';

import { useMemo } from 'react';
import { useWorkspace } from '@/lib/workspace-store';
import type { NodeType } from '@/lib/types';
import {
  buildOutgoingChildrenMap,
  getRootNodeIds,
  getVisibleNodeIds,
} from '@/lib/canvas-visibility';
import { NODE_CANVAS_TOOLBAR_HEIGHT_PX } from '@/lib/canvas-node-chrome';
import { useI18n } from '@/components/i18n-provider';

const NODE_COLORS: Record<NodeType, string> = {
  root: '#00C49A',
  query: '#60A5FA',
  'query-template': '#D97706',
  answer: '#A3E635',
  data: '#F59E0B',
};

export function MiniMap() {
  const { t } = useI18n();
  const { state } = useWorkspace();
  const { nodes, edges, viewport, collapsedNodeIds } = state;

  const visibleIds = useMemo(() => {
    const childrenMap = buildOutgoingChildrenMap(edges);
    const roots = getRootNodeIds(nodes, edges);
    return getVisibleNodeIds(roots, childrenMap, new Set(collapsedNodeIds));
  }, [nodes, edges, collapsedNodeIds]);

  if (nodes.length === 0) return null;

  const SCALE = 0.08;
  const W = 180;
  const H = 120;
  const PAD = 16;

  // Safe window dimensions — always valid in 'use client' during paint
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1440;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 900;

  return (
    <div
      className="absolute bottom-4 right-4 z-20 overflow-hidden rounded-xl border border-border bg-card/95 backdrop-blur-sm"
      style={{ width: W + PAD * 2, height: H + PAD * 2 + 22 }}
      role="img"
      aria-label={t('minimap.overview')}
    >
      <div className="flex items-center justify-between px-3 pt-2 pb-1">
        <span className="text-xs font-medium text-muted-foreground">{t('minimap.overview')}</span>
        <span className="font-mono text-xs text-muted-foreground/60">
          {t('minimap.zoomPercent', { pct: Math.round(viewport.zoom * 100) })}
        </span>
      </div>
      <svg width={W} height={H} className="mx-auto block">
        {nodes.map((n) => {
          const x = n.position.x * SCALE;
          const y = n.position.y * SCALE;
          const w = (n.width ?? 280) * SCALE;
          const h = ((n.height ?? 100) + NODE_CANVAS_TOOLBAR_HEIGHT_PX) * SCALE;
          const color = NODE_COLORS[n.type];
          const hidden = !visibleIds.has(n.id);
          return (
            <rect
              key={n.id}
              x={x}
              y={y}
              width={Math.max(w, 4)}
              height={Math.max(h, 3)}
              rx={1.5}
              fill={color}
              fillOpacity={
                hidden ? 0.08 : n.status === 'suggested' ? 0.2 : 0.5
              }
              stroke={color}
              strokeWidth={0.5}
              strokeOpacity={hidden ? 0.15 : 0.6}
            />
          );
        })}

        {/* Viewport rect */}
        <rect
          x={-viewport.x * SCALE}
          y={-viewport.y * SCALE}
          width={(vw / viewport.zoom) * SCALE}
          height={(vh / viewport.zoom) * SCALE}
          fill="none"
          stroke="rgba(255,255,255,0.25)"
          strokeWidth={1}
          rx={1}
        />
      </svg>
    </div>
  );
}
