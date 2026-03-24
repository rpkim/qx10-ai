'use client';

import { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import { useWorkspace } from '@/lib/workspace-store';
import { useI18n } from '@/components/i18n-provider';
import { QuestionTemplatePlaceDialog } from '@/components/question-template-place-dialog';
import { ConnectionLines } from './connection-lines';
import { NodeChrome } from './node-chrome';
import { RootNode } from '@/components/nodes/root-node';
import { QueryNode } from '@/components/nodes/query-node';
import { QueryTemplateNode } from '@/components/nodes/query-template-node';
import { AnswerNode } from '@/components/nodes/answer-node';
import { DataNode } from '@/components/nodes/data-node';
import type { WorkspaceNode, Position } from '@/lib/types';
import {
  buildOutgoingChildrenMap,
  getRootNodeIds,
  getVisibleNodeIds,
} from '@/lib/canvas-visibility';

export function Canvas() {
  const { t } = useI18n();
  const { state, dispatch, addQueryTemplateNode } = useWorkspace();
  const { nodes, edges, viewport, selectedNodeId, collapsedNodeIds } = state;
  const { x: panX, y: panY, zoom } = viewport;

  const childrenMap = useMemo(() => buildOutgoingChildrenMap(edges), [edges]);
  const collapsedSet = useMemo(() => new Set(collapsedNodeIds), [collapsedNodeIds]);
  const visibleIds = useMemo(() => {
    const roots = getRootNodeIds(nodes, edges);
    return getVisibleNodeIds(roots, childrenMap, collapsedSet);
  }, [nodes, edges, childrenMap, collapsedSet]);
  const visibleNodes = useMemo(
    () => nodes.filter((n) => visibleIds.has(n.id)),
    [nodes, visibleIds]
  );

  const canvasRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const draggingNode = useRef<{ id: string; startMouse: Position; startNode: Position } | null>(null);
  const spaceHeld = useRef(false);
  const [cursor, setCursor] = useState<'default' | 'grab' | 'grabbing'>('default');
  const [canvasCtx, setCanvasCtx] = useState<{ x: number; y: number } | null>(null);
  const [placeTemplate, setPlaceTemplate] = useState<{
    open: boolean;
    world: Position | null;
  }>({ open: false, world: null });
  const canvasCtxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!canvasCtx) return;
    const onDown = (e: MouseEvent) => {
      if (canvasCtxRef.current?.contains(e.target as Node)) return;
      setCanvasCtx(null);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [canvasCtx]);

  /* ── Spacebar hold to pan ── */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && !spaceHeld.current) {
        spaceHeld.current = true;
        setCursor('grab');
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceHeld.current = false;
        if (!isPanning.current) setCursor('default');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  /* ── Wheel zoom (pinch or ctrl+scroll) ── */
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    const canScrollWithin = (target: EventTarget | null, deltaY: number): boolean => {
      let cur = target as HTMLElement | null;
      while (cur && cur !== el) {
        if (cur.dataset.nodeScroll === 'true') {
          const max = cur.scrollHeight - cur.clientHeight;
          if (max <= 0) return false;
          // allow native scrolling while there is still room in scroll direction
          if (deltaY < 0) return cur.scrollTop > 0;
          if (deltaY > 0) return cur.scrollTop < max;
          return true;
        }
        cur = cur.parentElement;
      }
      return false;
    };

    const onWheel = (e: WheelEvent) => {
      if (canScrollWithin(e.target, e.deltaY)) {
        return;
      }
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        // Zoom toward mouse cursor position
        const rect = el.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const factor = e.deltaY < 0 ? 1.08 : 0.93;
        const newZoom = Math.min(Math.max(viewport.zoom * factor, 0.15), 3);
        const scale = newZoom / viewport.zoom;
        dispatch({
          type: 'SET_VIEWPORT',
          viewport: {
            zoom: newZoom,
            x: mouseX - (mouseX - viewport.x) * scale,
            y: mouseY - (mouseY - viewport.y) * scale,
          },
        });
      } else {
        // Two-finger scroll / trackpad pan
        dispatch({
          type: 'SET_VIEWPORT',
          viewport: {
            x: viewport.x - e.deltaX,
            y: viewport.y - e.deltaY,
          },
        });
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [viewport, dispatch]);

  /* ── Mouse down: start pan on blank canvas, or space+drag anywhere ── */
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const onBlankCanvas = e.target === canvasRef.current ||
        (e.target as HTMLElement).dataset.canvasBg === 'true';
      const isMiddleClick = e.button === 1;
      const isPanIntent = isMiddleClick || spaceHeld.current || onBlankCanvas;

      if (isPanIntent && e.button !== 2) {
        e.preventDefault();
        isPanning.current = true;
        panStart.current = { x: e.clientX - panX, y: e.clientY - panY };
        setCursor('grabbing');
      }
    },
    [panX, panY]
  );

  /* ── Global mouse move / up (so pan works even when cursor leaves nodes) ── */
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
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
        const currentZoom = (window as any).__qx10Zoom ?? 1;
        const dx = (e.clientX - startMouse.x) / currentZoom;
        const dy = (e.clientY - startMouse.y) / currentZoom;
        dispatch({
          type: 'MOVE_NODE',
          id,
          position: { x: startNode.x + dx, y: startNode.y + dy },
        });
      }
    };
    const onUp = () => {
      if (isPanning.current) {
        isPanning.current = false;
        setCursor(spaceHeld.current ? 'grab' : 'default');
      }
      draggingNode.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dispatch]);

  // Expose zoom to global so node drag handler can read it without closure staleness
  useEffect(() => {
    (window as any).__qx10Zoom = zoom;
  }, [zoom]);

  const startNodeDrag = useCallback(
    (nodeId: string, nodePos: Position, e: React.MouseEvent) => {
      if (e.button !== 0) return; // only primary button drags; right-click keeps context menu
      if (spaceHeld.current) return; // space held → pan, not node drag
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
      if (e.target === canvasRef.current ||
          (e.target as HTMLElement).dataset.canvasBg === 'true') {
        dispatch({ type: 'SELECT_NODE', id: null });
      }
    },
    [dispatch]
  );

  const handleCanvasContextMenu = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('[data-workspace-node]')) return;
    e.preventDefault();
    setCanvasCtx({ x: e.clientX, y: e.clientY });
  }, []);

  const cursorStyle =
    cursor === 'grabbing' ? 'grabbing' :
    cursor === 'grab'     ? 'grab' :
    spaceHeld.current     ? 'grab' : 'default';

  return (
    <div
      ref={canvasRef}
      className="absolute inset-0 overflow-hidden select-none"
      style={{ cursor: cursorStyle, background: 'var(--background)' }}
      onMouseDown={handleMouseDown}
      onClick={handleCanvasClick}
      onContextMenu={handleCanvasContextMenu}
    >
      {/* Dot-grid background — tagged so blank-area detection works */}
      <div
        data-canvas-bg="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(0,196,154,0.18) 1px, transparent 1px)',
          backgroundSize: `${32 * zoom}px ${32 * zoom}px`,
          backgroundPosition: `${panX % (32 * zoom)}px ${panY % (32 * zoom)}px`,
        }}
      />

      {/* Canvas transform wrapper — full graph bounds for html2canvas export */}
      <div
        id="workspace-graph-capture-root"
        className="absolute origin-top-left"
        style={{
          transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
          width: '8000px',
          height: '6000px',
          pointerEvents: cursor === 'grabbing' ? 'none' : 'auto',
        }}
      >
        {/* SVG connection layer */}
        <ConnectionLines visibleNodeIds={visibleIds} />

        {/* Node layer */}
        {visibleNodes.map((node) => (
          <NodeRenderer
            key={node.id}
            node={node}
            isSelected={selectedNodeId === node.id}
            onDragStart={startNodeDrag}
            hasChildren={(childrenMap.get(node.id)?.length ?? 0) > 0}
            isCollapsed={collapsedSet.has(node.id)}
          />
        ))}
      </div>

      {canvasCtx && (
        <div
          ref={canvasCtxRef}
          className="border-border bg-popover text-popover-foreground fixed z-[200] min-w-[220px] rounded-lg border py-1 shadow-lg"
          style={{ left: canvasCtx.x, top: canvasCtx.y }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <button
            type="button"
            className="hover:bg-accent block w-full px-3 py-2 text-left text-sm"
            onClick={() => {
              const el = canvasRef.current;
              if (!el || !canvasCtx) {
                setCanvasCtx(null);
                return;
              }
              const rect = el.getBoundingClientRect();
              const world: Position = {
                x: (canvasCtx.x - rect.left - panX) / zoom,
                y: (canvasCtx.y - rect.top - panY) / zoom,
              };
              setPlaceTemplate({ open: true, world });
              setCanvasCtx(null);
            }}
          >
            {t('templates.addFromMenu')}
          </button>
        </div>
      )}

      <QuestionTemplatePlaceDialog
        open={placeTemplate.open}
        onOpenChange={(open) => {
          if (!open) setPlaceTemplate({ open: false, world: null });
        }}
        onPick={(tpl) => {
          if (!placeTemplate.world) return;
          addQueryTemplateNode({
            displayName: tpl.name,
            pattern: tpl.pattern,
            position: placeTemplate.world,
            toolChoice: tpl.toolChoice,
            followUpQuestions: tpl.followUpQuestions,
          });
        }}
      />
    </div>
  );
}

function NodeRenderer({
  node,
  isSelected,
  onDragStart,
  hasChildren,
  isCollapsed,
}: {
  node: WorkspaceNode;
  isSelected: boolean;
  onDragStart: (id: string, pos: Position, e: React.MouseEvent) => void;
  hasChildren: boolean;
  isCollapsed: boolean;
}) {
  const { dispatch } = useWorkspace();

  const handleMouseDown = (e: React.MouseEvent) => {
    dispatch({ type: 'SELECT_NODE', id: node.id });
    if (e.button === 0) {
      onDragStart(node.id, node.position, e);
    }
  };

  const style: React.CSSProperties = {
    position: 'absolute',
    left: node.position.x,
    top: node.position.y,
    width: node.width ?? (node.type === 'data' ? 320 : 280),
    userSelect: 'none',
  };

  const wrapperClass = [
    'relative flex cursor-move flex-col transition-shadow duration-200',
    isSelected ? 'ring-2 ring-primary rounded-2xl' : '',
  ].join(' ');

  return (
    <div
      data-workspace-node="true"
      style={style}
      className={wrapperClass}
      onMouseDown={handleMouseDown}
    >
      <NodeChrome node={node} hasChildren={hasChildren} isCollapsed={isCollapsed} />
      <div className="min-h-0 min-w-0 flex-1">
        {node.type === 'root' && <RootNode node={node as any} />}
        {node.type === 'query' && <QueryNode node={node as any} />}
        {node.type === 'query-template' && (
          <QueryTemplateNode node={node as any} />
        )}
        {node.type === 'answer' && <AnswerNode node={node as any} />}
        {node.type === 'data' && <DataNode node={node as any} />}
      </div>
    </div>
  );
}
