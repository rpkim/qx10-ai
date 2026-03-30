import { z } from 'zod';
import type { Edge, TemplateSlotNodeData, WorkspaceState, WorkspaceNode } from './types';
import { NODE_CANVAS_TOOLBAR_HEIGHT_PX } from './canvas-node-chrome';

export const WORKSPACE_SNAPSHOT_VERSION = 1 as const;
const STORAGE_PREFIX = 'qx10.workspace.v1';

const goalSchema = z.enum(['learn', 'build', 'research', 'analyze', 'strategize']);

const nodeStatusSchema = z.enum([
  'idle',
  'suggested',
  'running',
  'streaming',
  'complete',
  'error',
]);

const positionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

const baseNode = {
  id: z.string(),
  position: positionSchema,
  parentId: z.string().optional(),
  status: nodeStatusSchema,
  width: z.number().optional(),
  height: z.number().optional(),
  isPinned: z.boolean().optional(),
};

const rootNodeSchema = z.object({
  ...baseNode,
  type: z.literal('root'),
  keyword: z.string(),
  goal: goalSchema,
});

const queryNodeSchema = z.object({
  ...baseNode,
  type: z.literal('query'),
  question: z.string(),
  isCustom: z.boolean().optional(),
  modelChoice: z.string().optional(),
  toolChoice: z.enum(['auto', 'web', 'market']).optional(),
});

/** Legacy: slots embedded on `query-template` (expanded to `template-slot` nodes on load). */
const embeddedTemplateSlotSchema = z.object({
  id: z.string(),
  values: z.record(z.string(), z.string()),
  linkedQueryId: z.string().optional(),
});

const queryTemplateNodeSchema = z.object({
  ...baseNode,
  type: z.literal('query-template'),
  templateName: z.string(),
  pattern: z.string(),
  slots: z.array(embeddedTemplateSlotSchema).optional(),
  modelChoice: z.string().optional(),
  toolChoice: z.enum(['auto', 'web', 'market']).optional(),
  followUpQuestions: z.array(z.string()).optional(),
});

const templateSlotNodeSchema = z.object({
  ...baseNode,
  type: z.literal('template-slot'),
  templateNodeId: z.string(),
  values: z.record(z.string(), z.string()),
  linkedQueryId: z.string().optional(),
});

const answerNodeSchema = z.object({
  ...baseNode,
  type: z.literal('answer'),
  queryId: z.string(),
  content: z.string().default(''),
  streamedChars: z.number().optional(),
  extractedKeywords: z.array(z.string()).default([]),
  suggestedQueries: z.array(z.string()).default([]),
});

const chartPointSchema = z.object({
  label: z.string(),
  value: z.number(),
  value2: z.number().optional(),
});

const dataNodeSchema = z.object({
  ...baseNode,
  type: z.literal('data'),
  dataType: z.enum(['table', 'bar-chart', 'line-chart', 'list', 'metric']),
  title: z.string(),
  subtitle: z.string().optional(),
  tableColumns: z.array(z.string()).optional(),
  tableRows: z.array(z.record(z.union([z.string(), z.number()]))).optional(),
  chartData: z.array(chartPointSchema).optional(),
  metrics: z
    .array(
      z.object({
        label: z.string(),
        value: z.string(),
        change: z.string().optional(),
        up: z.boolean().optional(),
      })
    )
    .optional(),
  listItems: z.array(z.string()).optional(),
});

const workspaceNodeSchema = z.discriminatedUnion('type', [
  rootNodeSchema,
  queryNodeSchema,
  queryTemplateNodeSchema,
  templateSlotNodeSchema,
  answerNodeSchema,
  dataNodeSchema,
]);

const workspaceSnapshotSchema = z.object({
  version: z.literal(WORKSPACE_SNAPSHOT_VERSION),
  savedAt: z.string().optional(),
  keyword: z.string(),
  goal: goalSchema,
  nodes: z.array(workspaceNodeSchema),
  edges: z.array(
    z.object({
      id: z.string(),
      sourceId: z.string(),
      targetId: z.string(),
    })
  ),
  viewport: z.object({
    x: z.number(),
    y: z.number(),
    zoom: z.number(),
  }),
  dashboardNodeIds: z.array(z.string()).default([]),
  collapsedNodeIds: z.array(z.string()).default([]),
});

export type WorkspaceSnapshotFile = z.infer<typeof workspaceSnapshotSchema>;

/** Drop slot→slot edges; ensure each slot has slot→template (fixes older vertical chains). */
export function normalizeTemplateSlotGraph(nodes: WorkspaceNode[], edges: Edge[]): Edge[] {
  const slotNodes = nodes.filter((n): n is TemplateSlotNodeData => n.type === 'template-slot');
  const slotById = new Map(slotNodes.map((n) => [n.id, n]));
  let next = edges.filter((e) => {
    const a = slotById.get(e.sourceId);
    const b = slotById.get(e.targetId);
    if (a && b && a.templateNodeId === b.templateNodeId) return false;
    return true;
  });
  const byTemplate = new Map<string, TemplateSlotNodeData[]>();
  for (const s of slotNodes) {
    const arr = byTemplate.get(s.templateNodeId) ?? [];
    arr.push(s);
    byTemplate.set(s.templateNodeId, arr);
  }
  for (const [tid, slots] of byTemplate) {
    if (!nodes.some((n) => n.id === tid && n.type === 'query-template')) continue;
    for (const s of slots) {
      const has = next.some((e) => e.sourceId === s.id && e.targetId === tid);
      if (!has) {
        next.push({
          id: `e-${s.id}-${tid}-norm`,
          sourceId: s.id,
          targetId: tid,
        });
      }
    }
  }
  const seen = new Set<string>();
  return next.filter((e) => {
    const k = `${e.sourceId}->${e.targetId}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

const LEGACY_SLOT_LAYOUT_GAP_Y = 108;
const LEGACY_SLOT_NODE_H = 240;

function snapshotHasLegacyEmbeddedSlots(
  nodes: WorkspaceSnapshotFile['nodes']
): boolean {
  return nodes.some(
    (n) =>
      (n as { type: string }).type === 'query-template' &&
      Array.isArray((n as { slots?: unknown }).slots) &&
      ((n as { slots?: unknown[] }).slots?.length ?? 0) > 0
  );
}

function expandLegacyEmbeddedSlots(
  d: WorkspaceSnapshotFile
): WorkspaceSnapshotFile {
  const nextNodes: WorkspaceSnapshotFile['nodes'] = [];
  const extraNodes: WorkspaceSnapshotFile['nodes'] = [];
  const edges = [...d.edges];

  for (const raw of d.nodes) {
    if (raw.type !== 'query-template') {
      nextNodes.push(raw);
      continue;
    }
    const tpl = raw as typeof raw & {
      slots?: z.infer<typeof embeddedTemplateSlotSchema>[];
    };
    const slots = tpl.slots;
    if (!slots?.length) {
      const { slots: _s, ...rest } = tpl;
      nextNodes.push(rest as WorkspaceSnapshotFile['nodes'][number]);
      continue;
    }

    const tw = tpl.width ?? 300;
    const gapX = 64;
    const rowY =
      tpl.position.y - NODE_CANVAS_TOOLBAR_HEIGHT_PX - LEGACY_SLOT_NODE_H - LEGACY_SLOT_LAYOUT_GAP_Y;
    const totalW = slots.length * tw + (slots.length - 1) * gapX;
    let curX = tpl.position.x + tw / 2 - totalW / 2;
    for (let i = 0; i < slots.length; i++) {
      extraNodes.push({
        id: slots[i].id,
        type: 'template-slot',
        templateNodeId: tpl.id,
        values: slots[i].values,
        ...(slots[i].linkedQueryId ? { linkedQueryId: slots[i].linkedQueryId } : {}),
        position: { x: curX, y: rowY },
        status: tpl.status,
        width: tw,
        height: LEGACY_SLOT_NODE_H,
      } as WorkspaceSnapshotFile['nodes'][number]);
      curX += tw + gapX;
    }

    for (const s of slots) {
      edges.push({
        id: `e-${s.id}-${tpl.id}-mig`,
        sourceId: s.id,
        targetId: tpl.id,
      });
    }

    const { slots: _s, ...rest } = tpl;
    nextNodes.push(rest as WorkspaceSnapshotFile['nodes'][number]);
  }

  return {
    ...d,
    nodes: [...nextNodes, ...extraNodes],
    edges,
  };
}

export type SnapshotErrorCode =
  | 'invalid_format'
  | 'json_parse'
  | 'browser_only'
  | 'no_keyword'
  | 'storage_full'
  | 'no_saved';

export type SnapshotOk = { ok: true; state: WorkspaceState };
export type SnapshotErr = { ok: false; code: SnapshotErrorCode };

function storageKey(keyword: string): string {
  return `${STORAGE_PREFIX}:${encodeURIComponent(keyword)}`;
}

export function removeWorkspaceFromLocalStorage(keyword: string): void {
  if (typeof window === 'undefined' || !keyword.trim()) return;
  try {
    localStorage.removeItem(storageKey(keyword));
  } catch {
    /* ignore */
  }
}

export function workspaceToSnapshotPayload(state: WorkspaceState): WorkspaceSnapshotFile {
  return {
    version: WORKSPACE_SNAPSHOT_VERSION,
    savedAt: new Date().toISOString(),
    keyword: state.keyword,
    goal: state.goal,
    nodes: state.nodes as WorkspaceSnapshotFile['nodes'],
    edges: state.edges,
    viewport: state.viewport,
    dashboardNodeIds: state.dashboardNodeIds,
    collapsedNodeIds: state.collapsedNodeIds,
  };
}

export function serializeWorkspaceSnapshot(state: WorkspaceState, pretty = false): string {
  const payload = workspaceToSnapshotPayload(state);
  return JSON.stringify(payload, null, pretty ? 2 : undefined);
}

export function parseWorkspaceSnapshot(raw: unknown): SnapshotOk | SnapshotErr {
  const parsed = workspaceSnapshotSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, code: 'invalid_format' };
  }
  let d = parsed.data;
  if (snapshotHasLegacyEmbeddedSlots(d.nodes)) {
    d = expandLegacyEmbeddedSlots(d);
  }
  const nodes = d.nodes as WorkspaceNode[];
  const edges = normalizeTemplateSlotGraph(nodes, d.edges);
  const state: WorkspaceState = {
    keyword: d.keyword,
    goal: d.goal,
    nodes,
    edges,
    viewport: d.viewport,
    selectedNodeIds: [],
    dashboardNodeIds: d.dashboardNodeIds,
    collapsedNodeIds: d.collapsedNodeIds,
  };
  return { ok: true, state };
}

export function parseWorkspaceSnapshotString(json: string): SnapshotOk | SnapshotErr {
  let data: unknown;
  try {
    data = JSON.parse(json) as unknown;
  } catch {
    return { ok: false, code: 'json_parse' };
  }
  return parseWorkspaceSnapshot(data);
}

export function saveWorkspaceToLocalStorage(state: WorkspaceState): { ok: true } | SnapshotErr {
  if (typeof window === 'undefined') return { ok: false, code: 'browser_only' };
  if (!state.keyword.trim()) return { ok: false, code: 'no_keyword' };
  try {
    localStorage.setItem(storageKey(state.keyword), serializeWorkspaceSnapshot(state));
    return { ok: true };
  } catch {
    return { ok: false, code: 'storage_full' };
  }
}

export function loadWorkspaceFromLocalStorage(keyword: string): SnapshotOk | SnapshotErr {
  if (typeof window === 'undefined') return { ok: false, code: 'browser_only' };
  const raw = localStorage.getItem(storageKey(keyword));
  if (!raw) return { ok: false, code: 'no_saved' };
  return parseWorkspaceSnapshotString(raw);
}

export function hasWorkspaceInLocalStorage(keyword: string): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(storageKey(keyword)) != null;
}

/** Every keyword that has a saved snapshot under `qx10.workspace.v1:*` (not only the recent index). */
export function listAllWorkspaceKeywordsInLocalStorage(): string[] {
  if (typeof window === 'undefined') return [];
  const prefix = `${STORAGE_PREFIX}:`;
  const seen = new Set<string>();
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k?.startsWith(prefix)) continue;
    const encoded = k.slice(prefix.length);
    try {
      const keyword = decodeURIComponent(encoded);
      if (keyword.trim()) seen.add(keyword);
    } catch {
      /* malformed key */
    }
  }
  return Array.from(seen);
}

export function downloadWorkspaceJson(state: WorkspaceState): void {
  if (typeof window === 'undefined') return;
  const safe =
    state.keyword.replace(/[^\w\s\-.\u0080-\uFFFF]/gi, '_').slice(0, 48) || 'workspace';
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const blob = new Blob([serializeWorkspaceSnapshot(state, true)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `qx10-${safe}-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
