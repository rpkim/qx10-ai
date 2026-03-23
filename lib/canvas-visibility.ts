import type { Edge, WorkspaceNode } from '@/lib/types';

/** sourceId → direct child ids (from edges). */
export function buildOutgoingChildrenMap(edges: Edge[]): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const e of edges) {
    if (!m.has(e.sourceId)) m.set(e.sourceId, []);
    m.get(e.sourceId)!.push(e.targetId);
  }
  return m;
}

/** Nodes with no incoming edge (tree roots). */
export function getRootNodeIds(nodes: WorkspaceNode[], edges: Edge[]): string[] {
  const targets = new Set(edges.map((e) => e.targetId));
  return nodes.filter((n) => !targets.has(n.id)).map((n) => n.id);
}

/**
 * Nodes visible when some branches are collapsed.
 * If `id` is in `collapsed`, its descendants are hidden (not visited).
 */
export function getVisibleNodeIds(
  rootIds: string[],
  childrenMap: Map<string, string[]>,
  collapsed: Set<string>
): Set<string> {
  const visible = new Set<string>();

  function walk(id: string) {
    visible.add(id);
    if (collapsed.has(id)) return;
    for (const c of childrenMap.get(id) ?? []) {
      walk(c);
    }
  }

  for (const r of rootIds) {
    walk(r);
  }
  return visible;
}
