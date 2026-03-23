'use client';

import { NODE_CANVAS_TOOLBAR_HEIGHT_PX } from '@/lib/canvas-node-chrome';
import { useWorkspace } from '@/lib/workspace-store';

export function ConnectionLines({ visibleNodeIds }: { visibleNodeIds: Set<string> }) {
  const { state } = useWorkspace();
  const { nodes, edges } = state;

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  return (
    <svg
      className="pointer-events-none absolute left-0 top-0"
      style={{ width: '8000px', height: '6000px', overflow: 'visible' }}
    >
      <defs>
        <marker
          id="arrowhead"
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L0,6 L8,3 z" fill="rgba(0,196,154,0.62)" />
        </marker>
      </defs>
      {edges.map((edge) => {
        if (!visibleNodeIds.has(edge.sourceId) || !visibleNodeIds.has(edge.targetId)) {
          return null;
        }
        const src = nodeMap.get(edge.sourceId);
        const tgt = nodeMap.get(edge.targetId);
        if (!src || !tgt) return null;

        const srcW = src.width ?? 280;
        const srcH = src.height ?? 100;
        const tgtW = tgt.width ?? 280;

        const chrome = NODE_CANVAS_TOOLBAR_HEIGHT_PX;
        const x1 = src.position.x + srcW / 2;
        const y1 = src.position.y + chrome + srcH;
        const x2 = tgt.position.x + tgtW / 2;
        const y2 = tgt.position.y + chrome;

        const dy = Math.abs(y2 - y1);
        const cp = dy * 0.5;

        const path = `M ${x1},${y1} C ${x1},${y1 + cp} ${x2},${y2 - cp} ${x2},${y2}`;

        const isActive =
          src.status === 'running' || tgt.status === 'running' || tgt.status === 'streaming';

        return (
          <g key={edge.id}>
            {/* Glow line */}
            <path
              d={path}
              fill="none"
              stroke={isActive ? 'rgba(0,196,154,0.62)' : 'rgba(0,196,154,0.28)'}
              strokeWidth={isActive ? 2.25 : 1.8}
              strokeDasharray={tgt.status === 'suggested' ? '6 4' : undefined}
            />
            {/* Animated pulse dot for active edges */}
            {isActive && (
              <circle r="3" fill="#00C49A" opacity="0.9">
                <animateMotion dur="1.4s" repeatCount="indefinite" path={path} />
              </circle>
            )}
          </g>
        );
      })}
    </svg>
  );
}
