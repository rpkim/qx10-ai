import type { AnswerNodeData, QueryNodeData, WorkspaceNode, WorkspaceState } from '@/lib/types';

/**
 * After translating query `question` strings, keep each answer's `suggestedQueries`
 * aligned with child query nodes (same text as `child.question`) so
 * `findQueryIdByParentAndQuestion` and demo keys still match.
 */
export function syncIntroAnswerSuggestedQueriesWithChildQueries(
  state: WorkspaceState
): WorkspaceState {
  const nodes: WorkspaceNode[] = state.nodes.map((n) => ({ ...n } as WorkspaceNode));

  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n.type !== 'answer') continue;
    const a = n as AnswerNodeData;
    const children = nodes
      .filter(
        (x): x is QueryNodeData =>
          x.type === 'query' && x.parentId === a.id
      )
      .sort(
        (p, q) =>
          p.position.y - q.position.y ||
          p.position.x - q.position.x ||
          p.id.localeCompare(q.id)
      );
    const nextSq = children.map((q) => q.question);
    nodes[i] = { ...a, suggestedQueries: nextSq };
  }

  return { ...state, nodes };
}
