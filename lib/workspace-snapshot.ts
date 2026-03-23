import { z } from 'zod';
import type { WorkspaceState, WorkspaceNode } from './types';

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
  const d = parsed.data;
  const state: WorkspaceState = {
    keyword: d.keyword,
    goal: d.goal,
    nodes: d.nodes as WorkspaceNode[],
    edges: d.edges,
    viewport: d.viewport,
    selectedNodeId: null,
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
