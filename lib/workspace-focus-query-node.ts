'use client';

import type { Viewport, WorkspaceNode } from '@/lib/types';
import { getNodeWorldCenter } from '@/lib/workspace-node-bounds';

const CANVAS_ID = 'workspace-canvas';

type CanvasFocusDispatch = (
  action:
    | { type: 'EXPAND_TO_SHOW_NODE'; nodeId: string }
    | { type: 'SET_SELECTED_NODES'; ids: string[] }
    | { type: 'SET_VIEWPORT'; viewport: Viewport }
) => void;

const CANVAS_FOCUS_MAX_ATTEMPTS = 48;

/** Pan/zoom the canvas so the given node is centered (same behavior as the workspace node search). */
export function focusQueryNodeOnCanvas(
  node: WorkspaceNode,
  viewportZoom: number,
  dispatch: CanvasFocusDispatch
): void {
  dispatch({ type: 'EXPAND_TO_SHOW_NODE', nodeId: node.id });
  dispatch({ type: 'SET_SELECTED_NODES', ids: [node.id] });

  const apply = (attempt: number) => {
    if (typeof document === 'undefined') return;
    const canvasEl = document.getElementById(CANVAS_ID);
    const rect = canvasEl?.getBoundingClientRect();
    const rw = rect?.width ?? 0;
    const rh = rect?.height ?? 0;

    if ((rw < 2 || rh < 2) && attempt < CANVAS_FOCUS_MAX_ATTEMPTS) {
      requestAnimationFrame(() => apply(attempt + 1));
      return;
    }

    const w = rw >= 2 ? rw : typeof window !== 'undefined' ? window.innerWidth : 800;
    const h = rh >= 2 ? rh : typeof window !== 'undefined' ? window.innerHeight : 600;
    const { cx, cy } = getNodeWorldCenter(node);
    const z = viewportZoom;
    dispatch({
      type: 'SET_VIEWPORT',
      viewport: {
        x: w / 2 - cx * z,
        y: h / 2 - cy * z,
        zoom: z,
      },
    });
  };

  requestAnimationFrame(() => requestAnimationFrame(() => apply(0)));
}
