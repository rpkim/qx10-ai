import { NODE_CANVAS_TOOLBAR_HEIGHT_PX } from '@/lib/canvas-node-chrome';

/**
 * Read rendered body heights from the canvas DOM so auto-layout matches actual cards.
 * Returns content height only (excludes NodeChrome toolbar — layout adds that separately).
 */
export function measureWorkspaceNodeContentHeights(): Record<string, number> {
  const out: Record<string, number> = {};
  if (typeof document === 'undefined') return out;

  document
    .querySelectorAll<HTMLElement>('[data-workspace-node="true"]')
    .forEach((wrapper) => {
      const id = wrapper.dataset.workspaceNodeId;
      if (!id) return;

      const body = wrapper.querySelector<HTMLElement>('[data-workspace-node-body="true"]');
      if (body) {
        const h = body.offsetHeight;
        if (h > 0) out[id] = h;
        return;
      }

      const total = wrapper.offsetHeight;
      const content = total - NODE_CANVAS_TOOLBAR_HEIGHT_PX;
      if (content > 0) out[id] = content;
    });

  return out;
}
