import type { WorkspaceNode } from './types';
import { NODE_CANVAS_TOOLBAR_HEIGHT_PX } from './canvas-node-chrome';

/** Approximate node body height when `height` is missing (matches layout defaults). */
function defaultNodeHeight(n: WorkspaceNode): number {
  switch (n.type) {
    case 'root':
      return 100;
    case 'query':
      return 280;
    case 'query-template':
      return 360;
    case 'template-slot':
      return 240;
    case 'answer':
      return 520;
    case 'data':
      return 320;
    default:
      return 280;
  }
}

export function getNodeLayoutWidth(n: WorkspaceNode): number {
  return (
    n.width ??
    (n.type === 'data' ? 320 : n.type === 'root' ? 260 : n.type === 'query-template' ? 300 : 280)
  );
}

export function getNodeLayoutHeight(n: WorkspaceNode): number {
  return n.height ?? defaultNodeHeight(n);
}

/** World-space center for pan/zoom focus (chrome strip included vertically). */
export function getNodeWorldCenter(n: WorkspaceNode): { cx: number; cy: number } {
  const w = getNodeLayoutWidth(n);
  const h = getNodeLayoutHeight(n);
  return {
    cx: n.position.x + w / 2,
    cy: n.position.y + NODE_CANVAS_TOOLBAR_HEIGHT_PX + h / 2,
  };
}
