'use client';

import { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import { FOCUS_QUERY_NODE_EVENT, useWorkspace } from '@/lib/workspace-store';
import { focusQueryNodeOnCanvas } from '@/lib/workspace-focus-query-node';
import { useI18n } from '@/components/i18n-provider';
import { QuestionTemplatePlaceDialog } from '@/components/question-template-place-dialog';
import { ConnectionLines } from './connection-lines';
import { NodeChrome } from './node-chrome';
import { RootNode } from '@/components/nodes/root-node';
import { QueryNode } from '@/components/nodes/query-node';
import { QueryTemplateNode } from '@/components/nodes/query-template-node';
import { TemplateSlotNode } from '@/components/nodes/template-slot-node';
import { AnswerNode } from '@/components/nodes/answer-node';
import { DataNode } from '@/components/nodes/data-node';
import type { WorkspaceNode, Position } from '@/lib/types';
import {
  buildOutgoingChildrenMap,
  getRootNodeIds,
  getVisibleNodeIds,
} from '@/lib/canvas-visibility';
import { useIntroduceReveal } from '@/lib/introduce-reveal-context';

export function Canvas() {
  const { t } = useI18n();
  const { state, dispatch, addQueryTemplateNode } = useWorkspace();
  const { nodes, edges, viewport, selectedNodeIds, collapsedNodeIds } = state;
  const { x: panX, y: panY, zoom } = viewport;
  const introduceReveal = useIntroduceReveal();

  const childrenMap = useMemo(() => buildOutgoingChildrenMap(edges), [edges]);
  const collapsedSet = useMemo(() => new Set(collapsedNodeIds), [collapsedNodeIds]);
  const visibleIds = useMemo(() => {
    const roots = getRootNodeIds(nodes, edges);
    return getVisibleNodeIds(roots, childrenMap, collapsedSet);
  }, [nodes, edges, childrenMap, collapsedSet]);
  const visibleNodes = useMemo(() => {
    const collapsed = nodes.filter((n) => visibleIds.has(n.id));
    if (!introduceReveal) return collapsed;
    return collapsed.filter((n) => introduceReveal.isCanvasNodeVisible(n, nodes));
  }, [nodes, visibleIds, introduceReveal]);
  const lineVisibleIds = useMemo(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes]);

  const canvasRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const selectedRef = useRef<string[]>([]);
  const touchPanning = useRef(false);
  const draggingNode = useRef<{
    ids: string[];
    startMouse: Position;
    starts: Record<string, Position>;
  } | null>(null);
  const spaceHeld = useRef(false);
  const [cursor, setCursor] = useState<'default' | 'grab' | 'grabbing'>('default');
  const [canvasCtx, setCanvasCtx] = useState<{ x: number; y: number } | null>(null);
  const [placeTemplate, setPlaceTemplate] = useState<{
    open: boolean;
    world: Position | null;
  }>({ open: false, world: null });
  const canvasCtxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    selectedRef.current = selectedNodeIds;
  }, [selectedNodeIds]);

  useEffect(() => {
    const onFocusQuery = (e: Event) => {
      const id = (e as CustomEvent<{ queryId?: string }>).detail?.queryId;
      if (!id) return;
      const node = nodes.find((n) => n.id === id);
      if (!node) return;
      focusQueryNodeOnCanvas(node, viewport.zoom, dispatch);
    };
    window.addEventListener(FOCUS_QUERY_NODE_EVENT, onFocusQuery as EventListener);
    return () => window.removeEventListener(FOCUS_QUERY_NODE_EVENT, onFocusQuery as EventListener);
  }, [nodes, viewport.zoom, dispatch]);

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
      const target = e.target as HTMLElement;
      const onNode = !!target.closest('[data-workspace-node]');
      const onContextMenu = !!target.closest('[data-canvas-context-menu]');
      const onBlankCanvas = e.target === canvasRef.current || target.dataset.canvasBg === 'true';
      const onPanSurface = !onNode && !onContextMenu;
      const isMiddleClick = e.button === 1;
      const isPanIntent = isMiddleClick || spaceHeld.current || onBlankCanvas || onPanSurface;

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
    const applyMove = (clientX: number, clientY: number) => {
      if (isPanning.current) {
        dispatch({
          type: 'SET_VIEWPORT',
          viewport: {
            x: clientX - panStart.current.x,
            y: clientY - panStart.current.y,
          },
        });
      }
      if (draggingNode.current) {
        const { ids, startMouse, starts } = draggingNode.current;
        const currentZoom = (window as any).__qx10Zoom ?? 1;
        const dx = (clientX - startMouse.x) / currentZoom;
        const dy = (clientY - startMouse.y) / currentZoom;
        dispatch({
          type: 'MOVE_NODES',
          updates: ids.map((id) => ({
            id,
            position: { x: starts[id].x + dx, y: starts[id].y + dy },
          })),
        });
      }
    };
    const onMove = (e: MouseEvent) => {
      applyMove(e.clientX, e.clientY);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!isPanning.current && !draggingNode.current) return;
      if (e.touches.length === 0) return;
      const t = e.touches[0];
      applyMove(t.clientX, t.clientY);
      e.preventDefault();
    };
    const onUp = () => {
      if (isPanning.current) {
        isPanning.current = false;
        touchPanning.current = false;
        setCursor(spaceHeld.current ? 'grab' : 'default');
      }
      draggingNode.current = null;
    };
    const onTouchEnd = () => {
      onUp();
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [dispatch]);

  // Expose zoom to global so node drag handler can read it without closure staleness
  useEffect(() => {
    (window as any).__qx10Zoom = zoom;
  }, [zoom]);

  const startNodeDrag = useCallback(
    (nodeId: string, _nodePos: Position, e: React.MouseEvent) => {
      if (e.button !== 0) return;
      if (spaceHeld.current) return;
      e.stopPropagation();

      let dragIds: string[];
      const cur = selectedRef.current;
      if (e.shiftKey) {
        const set = new Set(cur);
        if (set.has(nodeId)) set.delete(nodeId);
        else set.add(nodeId);
        dragIds = Array.from(set);
        dispatch({ type: 'SET_SELECTED_NODES', ids: dragIds });
      } else if (cur.includes(nodeId) && cur.length > 1) {
        dragIds = [...cur];
      } else {
        dragIds = [nodeId];
        dispatch({ type: 'SET_SELECTED_NODES', ids: dragIds });
      }

      const starts: Record<string, Position> = {};
      for (const id of dragIds) {
        const n = nodes.find((x) => x.id === id);
        if (n) starts[id] = { ...n.position };
      }
      draggingNode.current = {
        ids: dragIds,
        startMouse: { x: e.clientX, y: e.clientY },
        starts,
      };
    },
    [dispatch, nodes]
  );

  const startNodeTouchDrag = useCallback(
    (nodeId: string, _nodePos: Position, t: { clientX: number; clientY: number }) => {
      let dragIds: string[];
      const cur = selectedRef.current;
      if (cur.includes(nodeId) && cur.length > 1) {
        dragIds = [...cur];
      } else {
        dragIds = [nodeId];
        dispatch({ type: 'SET_SELECTED_NODES', ids: dragIds });
      }

      const starts: Record<string, Position> = {};
      for (const id of dragIds) {
        const n = nodes.find((x) => x.id === id);
        if (n) starts[id] = { ...n.position };
      }
      draggingNode.current = {
        ids: dragIds,
        startMouse: { x: t.clientX, y: t.clientY },
        starts,
      };
    },
    [dispatch, nodes]
  );

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === canvasRef.current ||
          (e.target as HTMLElement).dataset.canvasBg === 'true') {
        dispatch({ type: 'SET_SELECTED_NODES', ids: [] });
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
      id="workspace-canvas"
      ref={canvasRef}
      className="absolute inset-0 overflow-hidden"
      style={{ cursor: cursorStyle, background: 'var(--background)' }}
      onMouseDown={handleMouseDown}
      onTouchStart={(e) => {
        if (e.touches.length !== 1) return;
        const target = e.target as HTMLElement;
        const onNode = !!target.closest('[data-workspace-node]');
        const onContextMenu = !!target.closest('[data-canvas-context-menu]');
        const onBlankCanvas =
          e.target === canvasRef.current || target.dataset.canvasBg === 'true';
        const onPanSurface = !onNode && !onContextMenu;
        if (!onBlankCanvas && !onPanSurface) return;
        const t = e.touches[0];
        isPanning.current = true;
        touchPanning.current = true;
        panStart.current = { x: t.clientX - panX, y: t.clientY - panY };
        setCursor('grabbing');
        e.preventDefault();
      }}
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
        <ConnectionLines visibleNodeIds={lineVisibleIds} />

        {/* Node layer */}
        {visibleNodes.map((node) => (
          <NodeRenderer
            key={node.id}
            node={node}
            isSelected={selectedNodeIds.includes(node.id)}
            onDragStart={startNodeDrag}
            onTouchDragStart={startNodeTouchDrag}
            hasChildren={(childrenMap.get(node.id)?.length ?? 0) > 0}
            isCollapsed={collapsedSet.has(node.id)}
          />
        ))}
      </div>

      {canvasCtx && (
        <div
          ref={canvasCtxRef}
          data-canvas-context-menu="true"
          className="border-border bg-popover text-popover-foreground fixed z-200 min-w-[220px] rounded-lg border py-1 shadow-lg"
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
  onTouchDragStart,
  hasChildren,
  isCollapsed,
}: {
  node: WorkspaceNode;
  isSelected: boolean;
  onDragStart: (id: string, pos: Position, e: React.MouseEvent) => void;
  onTouchDragStart: (id: string, pos: Position, t: { clientX: number; clientY: number }) => void;
  hasChildren: boolean;
  isCollapsed: boolean;
}) {
  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button,input,textarea,select,a,[contenteditable="true"],[data-node-interactive="true"]')) {
      return;
    }
    if (e.button === 0) {
      onDragStart(node.id, node.position, e);
    }
  };

  const style: React.CSSProperties = {
    position: 'absolute',
    left: node.position.x,
    top: node.position.y,
    width: node.width ?? (node.type === 'data' ? 320 : 280),
    userSelect: 'auto',
  };

  const wrapperClass = [
    'relative flex cursor-move flex-col transition-shadow duration-200',
    isSelected ? 'ring-2 ring-primary rounded-2xl' : '',
  ].join(' ');

  return (
    <div
      data-workspace-node="true"
      data-workspace-node-id={node.id}
      style={style}
      className={wrapperClass}
      onMouseDown={handleMouseDown}
      onTouchStart={(e) => {
        if (e.touches.length !== 1) return;
        const target = e.target as HTMLElement;
        if (target.closest('button,input,textarea,select,a,[contenteditable="true"],[data-node-interactive="true"]')) {
          return;
        }
        const touch = e.touches[0];
        onTouchDragStart(node.id, node.position, touch);
        e.preventDefault();
      }}
    >
      <NodeChrome node={node} hasChildren={hasChildren} isCollapsed={isCollapsed} />
      <div className="min-h-0 min-w-0 flex-1">
        {node.type === 'root' && <RootNode node={node as any} />}
        {node.type === 'query' && <QueryNode node={node as any} />}
        {node.type === 'query-template' && (
          <QueryTemplateNode node={node as any} />
        )}
        {node.type === 'template-slot' && (
          <TemplateSlotNode node={node as any} />
        )}
        {node.type === 'answer' && <AnswerNode node={node as any} />}
        {node.type === 'data' && <DataNode node={node as any} />}
      </div>
    </div>
  );
}
