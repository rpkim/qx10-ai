/**
 * Deep-merge locale overrides into the English introduce snapshot.
 * Keys in `nodes` are node ids; values are partial node objects (same shape as in workspace).
 */
export type IntroLocalePatch = {
  keyword?: string;
  goal?: string;
  nodes?: Record<string, Record<string, unknown>>;
};

export function applyIntroLocalePatch(
  base: unknown,
  patch: IntroLocalePatch | undefined
): unknown {
  if (!patch) return structuredClone(base);
  const state = structuredClone(base) as {
    keyword: string;
    goal: string;
    nodes: Array<Record<string, unknown> & { id: string }>;
  };
  if (patch.keyword !== undefined) state.keyword = patch.keyword;
  if (patch.goal !== undefined) state.goal = patch.goal;
  const patches = patch.nodes;
  if (!patches) return state;
  for (const node of state.nodes) {
    const p = patches[node.id];
    if (p) Object.assign(node, p);
  }
  return state;
}
