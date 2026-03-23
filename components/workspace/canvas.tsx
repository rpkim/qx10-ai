'use client';

import { useRef, useCallback, useEffect } from 'react';
import { useWorkspace } from '@/lib/workspace-store';
import { ConnectionLines } from './connection-lines';
import { RootNode } from '@/components/nodes/root-node';
import { QueryNode } from '@/components/nodes/query-node';
import { AnswerNode } from '@/components/nodes/answer-node';
import { DataNode } from '@/components/nodes/data-node';
import type { WorkspaceNode, Position } from '@/lib/types';

export function Canvas() {
  const { state, dispatch } = useWorkspace();
  const { nodes, viewport, selectedNodeId } = state;
  const { x: panX, y: panY, zoom } = viewport;

  const canvasRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const draggingNode = useRef<{ id: string; startMouse: Position; startNode: Position } | null>(null);

  /* ── Wheel zoom ── */
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.08 : 0.93;
      dispatch({
        type: 'SET_VIEWPORT',
        viewport: { zoom: Math.min(Math.max(viewport.zoom * factor, 0.2), 2.5) },
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [viewport.zoom, dispatch]);

  /* ── Pan (middle-click or space+drag) ── */
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.button === 1 || (e.button === 0 && (e.target as HTMLElement) === canvasRef.current)) {
        e.preventDefault();
        isPanning.current = true;
        panStart.current = { x: e.clientX - panX, y: e.clientY - panY };
      }
    },
    [panX, panY]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isPanning.current) {
        dispatch({
          type: 'SET_VIEWPORT',
          viewport: {
            x: e.clientX - panStart.current.x,
            y: e.clientY - panStart.current.y,
          },
        });
      }
      if (draggingNode.current) {
        const { id, startMouse, startNode } = draggingNode.current;
        const dx = (e.clientX - startMouse.x) / zoom;
        const dy = (e.clientY - startMouse.y) / zoom;
        dispatch({
          type: 'MOVE_NODE',
          id,
          position: { x: startNode.x + dx, y: startNode.y + dy },
        });
      }
    },
    [dispatch, zoom]
  );

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
    draggingNode.current = null;
  }, []);

  const startNodeDrag = useCallback(
    (nodeId: string, nodePos: Position, e: React.MouseEvent) => {
      e.stopPropagation();
      draggingNode.current = {
        id: nodeId,
        startMouse: { x: e.clientX, y: e.clientY },
        startNode: { ...nodePos },
      };
    },
    []
  );

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement) === canvasRef.current) {
        dispatch({ type: 'SELECT_NODE', id: null });
      }
    },
    [dispatch]
  );

  return (
    <div
      ref={canvasRef}
      className="absolute inset-0 overflow-hidden"
      style={{ cursor: isPanning.current ? 'grabbing' : 'grab', background: 'var(--background)' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={handleCanvasClick}
    >
      {/* Dot-grid background */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(0,196,154,0.18) 1px, transparent 1px)',
          backgroundSize: `${32 * zoom}px ${32 * zoom}px`,
          backgroundPosition: `${panX % (32 * zoom)}px ${panY % (32 * zoom)}px`,
        }}
      />

      {/* Canvas transform wrapper */}
      <div
        className="absolute origin-top-left"
        style={{
          transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
          width: '8000px',
          height: '6000px',
        }}
      >
        {/* SVG connection layer */}
        <ConnectionLines />

        {/* Node layer */}
        {nodes.map((node) => (
          <NodeRenderer
            key={node.id}
            node={node}
            isSelected={selectedNodeId === node.id}
            onDragStart={startNodeDrag}
          />
        ))}
      </div>
    </div>
  );
}

function NodeRenderer({
  node,
  isSelected,
  onDragStart,
}: {
  node: WorkspaceNode;
  isSelected: boolean;
  onDragStart: (id: string, pos: Position, e: React.MouseEvent) => void;
}) {
  const { dispatch } = useWorkspace();

  const handleMouseDown = (e: React.MouseEvent) => {
    onDragStart(node.id, node.position, e);
    dispatch({ type: 'SELECT_NODE', id: node.id });
  };

  const style: React.CSSProperties = {
    position: 'absolute',
    left: node.position.x,
    top: node.position.y,
    width: node.width ?? 280,
    userSelect: 'none',
  };

  const wrapperClass = [
    'cursor-move transition-shadow duration-200',
    isSelected ? 'ring-2 ring-primary rounded-2xl' : '',
  ].join(' ');

  return (
    <div style={style} className={wrapperClass} onMouseDown={handleMouseDown}>
      {node.type === 'root' && <RootNode node={node as any} />}
      {node.type === 'query' && <QueryNode node={node as any} />}
      {node.type === 'answer' && <AnswerNode node={node as any} />}
      {node.type === 'data' && <DataNode node={node as any} />}
    </div>
  );
}
