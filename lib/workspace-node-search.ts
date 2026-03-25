import type { Edge, WorkspaceNode } from './types';

/** All edge sources that point at `targetId` (walk upstream for expand). */
export function findIncomingAncestorIds(targetId: string, edges: Edge[]): string[] {
  const incoming = new Map<string, string[]>();
  for (const e of edges) {
    if (!incoming.has(e.targetId)) incoming.set(e.targetId, []);
    incoming.get(e.targetId)!.push(e.sourceId);
  }
  const out: string[] = [];
  const seen = new Set<string>();
  const q = [...(incoming.get(targetId) ?? [])];
  while (q.length) {
    const id = q.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    for (const p of incoming.get(id) ?? []) q.push(p);
  }
  return out;
}

function haystackForNode(n: WorkspaceNode, nodeById: Map<string, WorkspaceNode>): string {
  const parts: string[] = [n.id];
  switch (n.type) {
    case 'root':
      parts.push(n.keyword);
      break;
    case 'query':
      parts.push(n.question);
      break;
    case 'query-template':
      parts.push(n.templateName, n.pattern);
      break;
    case 'template-slot': {
      parts.push(...Object.values(n.values));
      const tpl = nodeById.get(n.templateNodeId);
      if (tpl?.type === 'query-template') {
        parts.push(tpl.templateName, tpl.pattern);
      }
      break;
    }
    case 'answer':
      parts.push(n.content, ...n.extractedKeywords, ...n.suggestedQueries);
      break;
    case 'data':
      parts.push(
        n.title,
        n.subtitle ?? '',
        ...(n.listItems ?? []),
        ...(n.tableColumns ?? [])
      );
      break;
    default:
      break;
  }
  return parts.join('\n');
}

export function searchWorkspaceNodeIds(nodes: WorkspaceNode[], query: string): string[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const matches: string[] = [];
  for (const n of nodes) {
    if (haystackForNode(n, nodeById).toLowerCase().includes(needle)) {
      matches.push(n.id);
    }
  }
  return matches;
}
