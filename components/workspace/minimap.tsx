'use client';

import { useWorkspace } from '@/lib/workspace-store';
import type { NodeType } from '@/lib/types';

const NODE_COLORS: Record<NodeType, string> = {
  root: '#00C49A',
  query: '#60A5FA',
  answer: '#A3E635',
  data: '#F59E0B',
};

export function MiniMap() {
  const { state, dispatch } = useWorkspace();
  const { nodes, viewport } = state;

  if (nodes.length === 0) return null;

  const SCALE = 0.08;
  const W = 180;
  const H = 120;
  const PAD = 16;

  return (
    <div
      className="absolute bottom-4 right-4 z-20 overflow-hidden rounded-xl border border-border bg-card/95 backdrop-blur-sm"
      style={{ width: W + PAD * 2, height: H + PAD * 2 }}
      role="img"
      aria-label="Minimap overview"
    >
      <div className="mb-1 px-3 pt-2 text-xs font-medium text-muted-foreground">Overview</div>
      <svg width={W} height={H} className="mx-auto block">
        {nodes.map((n) => {
          const x = n.position.x * SCALE;
          const y = n.position.y * SCALE;
          const w = (n.width ?? 280) * SCALE;
          const h = (n.height ?? 100) * SCALE;
          const color = NODE_COLORS[n.type];
          return (
            <rect
              key={n.id}
              x={x}
              y={y}
              width={Math.max(w, 4)}
              height={Math.max(h, 3)}
              rx={1.5}
              fill={color}
              fillOpacity={n.status === 'suggested' ? 0.2 : 0.5}
              stroke={color}
              strokeWidth={0.5}
              strokeOpacity={0.6}
            />
          );
        })}

        {/* Viewport rect */}
        <rect
          x={-viewport.x * SCALE}
          y={-viewport.y * SCALE}
          width={(window?.innerWidth ?? 1440) / viewport.zoom * SCALE}
          height={(window?.innerHeight ?? 900) / viewport.zoom * SCALE}
          fill="none"
          stroke="rgba(255,255,255,0.25)"
          strokeWidth={1}
          rx={1}
        />
      </svg>
    </div>
  );
}
