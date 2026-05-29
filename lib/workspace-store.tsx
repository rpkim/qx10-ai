'use client';

import * as React from 'react';
import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  type ReactNode,
} from 'react';
import type {
  WorkspaceState,
  WorkspaceNode,
  Edge,
  Viewport,
  GoalType,
  Position,
  AnswerNodeData,
  DataNodeData,
  DataNodeType,
  AiModelCatalog,
  QueryToolChoice,
  QueryTemplateNodeData,
  TemplateSlotNodeData,
} from './types';
import {
  parseTemplateVariableKeys,
  substituteTemplate,
} from '@/lib/question-templates';
import { toast } from 'sonner';
import { buildInitialWorkspace, getMockResponse } from './mock-data';
import { consumeWorkspaceQueryStream } from '@/lib/ai/consume-query-stream';
import { NODE_CANVAS_TOOLBAR_HEIGHT_PX } from './canvas-node-chrome';
import { measureWorkspaceNodeContentHeights } from './canvas-node-measure';
import { tr } from '@/lib/i18n/runtime';
import {
  normalizeTemplateSlotGraph,
} from './workspace-snapshot';
import { saveWorkspaceToServer } from './workspace-api';
import { findIncomingAncestorIds } from '@/lib/workspace-node-search';
import { isLocale, type Locale } from '@/lib/i18n/constants';

/* ─────────────────────────────────────────────
   Canvas layout (tree-aware — avoids Answer / Query overlap)
───────────────────────────────────────────── */

/** Vertical gap between parent bottom and child top */
const LAYOUT_GAP_Y = 108;
const LAYOUT_GAP_X = 64;
/** Template-slot row is compact: keep it closer to its template node. */
const TEMPLATE_SLOT_GAP_Y = 56;
/** Minimum horizontal step when we cannot use subtree width (e.g. root row) */
const LAYOUT_QUERY_SIBLING_X = 400;

/**
 * Estimated Answer card height for placement & auto-layout when DOM is unknown.
 * Keep in sync with typical Answer node (body + keywords + follow-ups).
 */
const CANVAS_ANSWER_LAYOUT_HEIGHT = 520;

/** Extra buffer so auto-layout stays below typical rendered cards (toolbar + controls). */
const LAYOUT_HEIGHT_BUFFER = 56;

const LAYOUT_DEFAULT_HEIGHT: Record<WorkspaceNode['type'], number> = {
  root: 100,
  query: 280,
  'query-template': 360,
  'template-slot': 200,
  answer: CANVAS_ANSWER_LAYOUT_HEIGHT + LAYOUT_HEIGHT_BUFFER + 40,
  data: 320,
};

function estimateTemplateSlotHeight(keyCount: number): number {
  return Math.max(
    140,
    NODE_CANVAS_TOOLBAR_HEIGHT_PX + 56 + keyCount * 40 + 64 + LAYOUT_HEIGHT_BUFFER
  );
}

/**
 * Layout uses stored height when present; otherwise conservative estimates so
 * auto-layout does not place children inside underestimated parent boxes (overlap).
 */
const ROOT_SEED_UI_ROWS = 6;
const ROOT_SEED_ROW_HEIGHT_PX = 42;

function estimateRootContentHeightPx(): number {
  return 140 + ROOT_SEED_UI_ROWS * ROOT_SEED_ROW_HEIGHT_PX + 72 + LAYOUT_HEIGHT_BUFFER;
}

function layoutNodeSize(n: WorkspaceNode, opts?: { measured?: boolean }): { w: number; h: number } {
  const w =
    n.width ??
    (n.type === 'root'
      ? 260
      : n.type === 'data'
        ? 320
        : n.type === 'query-template' || n.type === 'template-slot'
          ? 300
          : 280);
  let h = n.height ?? LAYOUT_DEFAULT_HEIGHT[n.type];

  if (opts?.measured && n.height != null && n.height > 0) {
    return { w, h: h + 16 };
  }

  if (n.type === 'query') {
    h = Math.max(h, 320 + LAYOUT_HEIGHT_BUFFER);
  } else if (n.type === 'query-template') {
    const bodyGuess = NODE_CANVAS_TOOLBAR_HEIGHT_PX + 220 + LAYOUT_HEIGHT_BUFFER;
    h = Math.max(h, bodyGuess);
  } else if (n.type === 'template-slot') {
    h = Math.max(h, 150 + LAYOUT_HEIGHT_BUFFER);
  } else if (n.type === 'data') {
    h = Math.max(h, 320 + LAYOUT_HEIGHT_BUFFER);
  } else if (n.type === 'answer') {
    h = Math.max(h, CANVAS_ANSWER_LAYOUT_HEIGHT + LAYOUT_HEIGHT_BUFFER + 64);
  } else if (n.type === 'root') {
    const seedBody =
      140 + ROOT_SEED_UI_ROWS * ROOT_SEED_ROW_HEIGHT_PX + 72 + LAYOUT_HEIGHT_BUFFER;
    h = Math.max(h, seedBody, 320 + LAYOUT_HEIGHT_BUFFER);
  }

  return { w, h };
}

function subtreeMaxRight(
  id: string,
  nodeMap: Map<string, WorkspaceNode>,
  childrenMap: Map<string, string[]>,
  positions: Map<string, Position>,
  sizeOf: (n: WorkspaceNode) => { w: number; h: number } = layoutNodeSize
): number {
  const n = nodeMap.get(id);
  if (!n) return 0;
  const pos = positions.get(id);
  if (!pos) return 0;
  const { w } = sizeOf(n);
  let right = pos.x + w;
  for (const c of childrenMap.get(id) ?? []) {
    right = Math.max(right, subtreeMaxRight(c, nodeMap, childrenMap, positions, sizeOf));
  }
  return right;
}

interface LayoutBox {
  bottom: number;
  rightEdge: number;
}

/**
 * Recursive layout: Answer → data nodes to the right; follow-up Queries in a row below the answer.
 */
function computeTreeAwareLayout(
  nodes: WorkspaceNode[],
  edges: Edge[],
  measuredHeights?: Record<string, number>
): WorkspaceNode[] {
  if (nodes.length === 0) return nodes;

  const measuredIds = new Set(Object.keys(measuredHeights ?? {}));
  const sizeOf = (n: WorkspaceNode) =>
    layoutNodeSize(n, { measured: measuredIds.has(n.id) });

  const chromeH = NODE_CANVAS_TOOLBAR_HEIGHT_PX;
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const childrenMap = new Map<string, string[]>();
  nodes.forEach((n) => childrenMap.set(n.id, []));
  edges.forEach((e) => {
    const src = nodeMap.get(e.sourceId);
    const tgt = nodeMap.get(e.targetId);
    if (src?.type === 'template-slot' && tgt?.type === 'query-template') return;
    if (
      src?.type === 'template-slot' &&
      tgt?.type === 'template-slot' &&
      src.templateNodeId === tgt.templateNodeId
    ) {
      return;
    }
    const bucket = childrenMap.get(e.sourceId);
    if (!bucket || bucket.includes(e.targetId)) return;
    bucket.push(e.targetId);
  });
  // parentId links without an edge (legacy / race) still participate in layout
  nodes.forEach((n) => {
    if (!n.parentId) return;
    const bucket = childrenMap.get(n.parentId);
    if (!bucket || bucket.includes(n.id)) return;
    bucket.push(n.id);
  });

  const positions = new Map<string, Position>();

  function countsAsLayoutIncoming(e: Edge): boolean {
    const src = nodeMap.get(e.sourceId);
    const tgt = nodeMap.get(e.targetId);
    if (src?.type === 'template-slot' && tgt?.type === 'query-template') return false;
    if (
      src?.type === 'template-slot' &&
      tgt?.type === 'template-slot' &&
      src.templateNodeId === tgt.templateNodeId
    ) {
      return false;
    }
    return true;
  }

  function layoutSubtree(id: string, x: number, y: number): LayoutBox {
    const n = nodeMap.get(id);
    if (!n) return { bottom: y, rightEdge: x };
    const { w, h } = sizeOf(n);
    const kids = childrenMap.get(id) ?? [];

    positions.set(id, { x, y });

    if (kids.length === 0) {
      return { bottom: y + h + chromeH, rightEdge: x + w };
    }

    if (n.type === 'root') {
      const rowY = y + h + chromeH + LAYOUT_GAP_Y;
      let maxBottom = y + h + chromeH;
      let maxRight = x + w;
      let qx = x;
      kids.forEach((kidId) => {
        const box = layoutSubtree(kidId, qx, rowY);
        maxBottom = Math.max(maxBottom, box.bottom);
        maxRight = Math.max(maxRight, box.rightEdge);
        qx = box.rightEdge + LAYOUT_GAP_X;
      });
      return { bottom: maxBottom, rightEdge: maxRight };
    }

    /** Multiple runs from one template → parallel columns (Q → A → …) like the topic root row. */
    if (n.type === 'query-template') {
      const rowY = y + h + chromeH + LAYOUT_GAP_Y;
      const queryKids = kids.filter((k) => nodeMap.get(k)?.type === 'query');
      const otherKids = kids.filter((k) => nodeMap.get(k)?.type !== 'query');
      let maxBottom = y + h + chromeH;
      let rightEdge = x + w;
      let qx = x;
      if (queryKids.length > 0) {
        queryKids.forEach((kidId) => {
          const box = layoutSubtree(kidId, qx, rowY);
          maxBottom = Math.max(maxBottom, box.bottom);
          rightEdge = Math.max(rightEdge, box.rightEdge);
          qx = box.rightEdge + LAYOUT_GAP_X;
        });
      }
      let curY = queryKids.length > 0 ? maxBottom + LAYOUT_GAP_Y : rowY;
      otherKids.forEach((kidId) => {
        const box = layoutSubtree(kidId, x, curY);
        maxBottom = Math.max(maxBottom, box.bottom);
        rightEdge = Math.max(rightEdge, box.rightEdge);
        curY = box.bottom + LAYOUT_GAP_Y;
      });
      return { bottom: maxBottom, rightEdge };
    }

    if (n.type === 'query') {
      let curY = y + h + chromeH + LAYOUT_GAP_Y;
      let maxBottom = y + h + chromeH;
      let rightEdge = x + w;
      kids.forEach((kidId) => {
        const box = layoutSubtree(kidId, x, curY);
        maxBottom = Math.max(maxBottom, box.bottom);
        rightEdge = Math.max(rightEdge, box.rightEdge);
        curY = box.bottom + LAYOUT_GAP_Y;
      });
      return { bottom: maxBottom, rightEdge };
    }

    if (n.type === 'answer') {
      const dataKids = kids.filter((k) => nodeMap.get(k)?.type === 'data');
      const queryKids = kids.filter((k) => nodeMap.get(k)?.type === 'query');
      let maxBottom = y + h + chromeH;
      let rightEdge = x + w;

      let dx = x + w + LAYOUT_GAP_X;
      dataKids.forEach((kidId) => {
        const box = layoutSubtree(kidId, dx, y);
        maxBottom = Math.max(maxBottom, box.bottom);
        rightEdge = Math.max(rightEdge, box.rightEdge);
        dx = box.rightEdge + LAYOUT_GAP_X;
      });

      const rowY = y + h + chromeH + LAYOUT_GAP_Y;
      let qx = x;
      queryKids.forEach((kidId) => {
        const box = layoutSubtree(kidId, qx, rowY);
        maxBottom = Math.max(maxBottom, box.bottom);
        rightEdge = Math.max(rightEdge, box.rightEdge);
        qx = Math.max(box.rightEdge + LAYOUT_GAP_X, qx + LAYOUT_QUERY_SIBLING_X);
      });

      return { bottom: maxBottom, rightEdge };
    }

    let curY = y + h + chromeH + LAYOUT_GAP_Y;
    let maxBottom = y + h + chromeH;
    let rightEdge = x + w;
    kids.forEach((kidId) => {
      const box = layoutSubtree(kidId, x, curY);
      maxBottom = Math.max(maxBottom, box.bottom);
      rightEdge = Math.max(rightEdge, box.rightEdge);
      curY = box.bottom + LAYOUT_GAP_Y;
    });
    return { bottom: maxBottom, rightEdge };
  }

  const roots = nodes.filter((n) => {
    if (edges.some((e) => e.targetId === n.id && countsAsLayoutIncoming(e))) return false;
    if (n.type === 'template-slot') return false;
    return true;
  });
  if (roots.length === 0) return nodes;

  const topicRoot = roots.find((r) => r.type === 'root');
  const packOrdered: WorkspaceNode[] = topicRoot
    ? [
        topicRoot,
        ...roots
          .filter((r) => r.id !== topicRoot.id)
          .sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y),
      ]
    : [...roots].sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y);

  const ROOT_PACK_GAP = LAYOUT_GAP_X * 5;
  let packCursorRight = -Infinity;
  packOrdered.forEach((r, i) => {
    const x = i === 0 ? r.position.x : packCursorRight + ROOT_PACK_GAP;
    const y = r.position.y;
    layoutSubtree(r.id, x, y);
    packCursorRight = Math.max(
      packCursorRight,
      subtreeMaxRight(r.id, nodeMap, childrenMap, positions, sizeOf)
    );
  });

  /** All slots for a template share one row directly above the template (not stacked on each other). */
  for (const tpl of nodes) {
    if (tpl.type !== 'query-template') continue;
    const slotIds = edges
      .filter((e) => e.targetId === tpl.id)
      .map((e) => e.sourceId)
      .filter((id) => {
        const s = nodeMap.get(id);
        return s?.type === 'template-slot' && s.templateNodeId === tpl.id;
      })
      .sort((a, b) => a.localeCompare(b));
    if (slotIds.length === 0) continue;
    const tplPos = positions.get(tpl.id);
    if (!tplPos) continue;
    const { w: tplW } = sizeOf(tpl);
    const widths = slotIds.map((id) => sizeOf(nodeMap.get(id)!).w);
    const heights = slotIds.map((id) => sizeOf(nodeMap.get(id)!).h);
    const maxSlotH = Math.max(...heights);
    const gapX = LAYOUT_GAP_X;
    const totalW = widths.reduce((acc, w, i) => acc + w + (i > 0 ? gapX : 0), 0);
    const rowY = tplPos.y - chromeH - maxSlotH - TEMPLATE_SLOT_GAP_Y;
    let cursorX = tplPos.x + tplW / 2 - totalW / 2;
    slotIds.forEach((sid, i) => {
      positions.set(sid, { x: cursorX, y: rowY });
      cursorX += widths[i] + gapX;
    });
  }

  return nodes.map((n) => ({
    ...n,
    position: positions.get(n.id) ?? n.position,
  }));
}

const DATA_NODE_TYPES: DataNodeType[] = [
  'table',
  'bar-chart',
  'line-chart',
  'list',
  'metric',
];

function isDataNodeType(v: string): v is DataNodeType {
  return DATA_NODE_TYPES.includes(v as DataNodeType);
}

/** Builds a data node from API JSON (best-effort). */
function dataNodeFromApiPayload(
  raw: Record<string, unknown> | null | undefined,
  dataId: string,
  answerId: string,
  answerPos: Position,
  answerLayoutWidth = 320
): DataNodeData | null {
  if (!raw || typeof raw !== 'object') return null;
  const dt = raw.dataType;
  const title = raw.title;
  if (typeof title !== 'string' || typeof dt !== 'string' || !isDataNodeType(dt)) return null;

  return {
    id: dataId,
    type: 'data',
    parentId: answerId,
    position: { x: answerPos.x + answerLayoutWidth + LAYOUT_GAP_X, y: answerPos.y },
    status: 'complete',
    dataType: dt,
    title,
    subtitle: typeof raw.subtitle === 'string' ? raw.subtitle : undefined,
    tableColumns: Array.isArray(raw.tableColumns)
      ? (raw.tableColumns as unknown[]).filter((c): c is string => typeof c === 'string')
      : undefined,
    tableRows: Array.isArray(raw.tableRows)
      ? (raw.tableRows as DataNodeData['tableRows'])
      : undefined,
    chartData: Array.isArray(raw.chartData)
      ? (raw.chartData as DataNodeData['chartData'])
      : undefined,
    metrics: Array.isArray(raw.metrics)
      ? (raw.metrics as DataNodeData['metrics'])
      : undefined,
    listItems: Array.isArray(raw.listItems)
      ? (raw.listItems as unknown[]).filter((c): c is string => typeof c === 'string')
      : undefined,
    width: 320,
    height: 280,
  };
}

const MAX_FOLLOWUP_QUERY_NODES = 8;

function readLocaleForAi(): Locale {
  if (typeof window === 'undefined') return 'en';
  try {
    const raw = window.localStorage.getItem('qx10.locale');
    return isLocale(raw) ? raw : 'en';
  } catch {
    return 'en';
  }
}

/** Slot values for a query spawned from a template row (for {{var}} in follow-ups). */
function slotValuesForTemplateQuery(
  nodes: WorkspaceNode[],
  queryId: string
): Record<string, string> | null {
  const q = nodes.find((n) => n.id === queryId && n.type === 'query');
  if (!q || q.type !== 'query' || !q.parentId) return null;
  const tpl = nodes.find(
    (n): n is QueryTemplateNodeData =>
      n.id === q.parentId && n.type === 'query-template'
  );
  if (!tpl) return null;
  const slot = nodes.find(
    (n): n is TemplateSlotNodeData =>
      n.type === 'template-slot' &&
      n.templateNodeId === tpl.id &&
      n.linkedQueryId === queryId
  );
  return slot?.values ?? null;
}

/** Template-stored follow-ups first (with {{var}} filled from the slot), then API suggestions; deduped. */
function mergeTemplateFollowUpsIntoSuggested(
  nodes: WorkspaceNode[],
  queryId: string,
  apiSuggested: string[]
): string[] {
  const q = nodes.find((n) => n.id === queryId && n.type === 'query');
  if (!q || q.type !== 'query' || !q.parentId) return apiSuggested;
  const parent = nodes.find((n) => n.id === q.parentId);
  if (!parent || parent.type !== 'query-template') return apiSuggested;
  const values = slotValuesForTemplateQuery(nodes, queryId);
  const extra = (parent.followUpQuestions ?? [])
    .map((s) => {
      const t = s.trim();
      if (!t) return '';
      return values ? substituteTemplate(t, values) : t;
    })
    .filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of [...extra, ...apiSuggested]) {
    const t = line.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

function attachAnswerChildren(
  dispatch: React.Dispatch<Action>,
  opts: {
    answerId: string;
    answerPos: Position;
    dataId: string;
    dataPayload: Record<string, unknown> | null | undefined;
  }
) {
  const { answerId, answerPos, dataId, dataPayload } = opts;

  const built = dataNodeFromApiPayload(dataPayload, dataId, answerId, answerPos, 320);
  if (built) {
    dispatch({ type: 'ADD_NODE', node: built });
    dispatch({
      type: 'ADD_EDGE',
      edge: { id: `e-${answerId}-${dataId}`, sourceId: answerId, targetId: dataId },
    });
  }
}

/* ─────────────────────────────────────────────
   Action types
───────────────────────────────────────────── */
type Action =
  | { type: 'INIT_WORKSPACE'; keyword: string; goal: GoalType; context?: string }
  | { type: 'SET_SEED_QUERIES'; questions: string[] }
  | { type: 'UPDATE_NODE'; id: string; updates: Partial<WorkspaceNode> }
  | { type: 'ADD_NODE'; node: WorkspaceNode }
  | { type: 'ADD_EDGE'; edge: Edge }
  | { type: 'DELETE_TEMPLATE_SLOT'; slotId: string }
  | { type: 'SET_VIEWPORT'; viewport: Partial<Viewport> }
  | { type: 'SET_SELECTED_NODES'; ids: string[] }
  | { type: 'EXPAND_TO_SHOW_NODE'; nodeId: string }
  | { type: 'TOGGLE_DASHBOARD_PIN'; id: string }
  | { type: 'MOVE_NODE'; id: string; position: Position }
  | { type: 'MOVE_NODES'; updates: { id: string; position: Position }[] }
  | { type: 'DELETE_NODE'; id: string }
  | { type: 'TOGGLE_COLLAPSE_BRANCH'; nodeId: string }
  | { type: 'RUN_QUERY'; queryId: string }
  /** Remove answer/data descendants of a query and reset it to suggested (for re-run). */
  | { type: 'CLEAR_QUERY_SUBTREE'; queryId: string }
  | {
      type: 'ANSWER_STREAMED';
      answerId: string;
      chars: number;
    }
  | { type: 'COMPLETE_ANSWER'; answerId: string }
  | { type: 'AUTO_LAYOUT'; measuredHeights?: Record<string, number> }
  | { type: 'LOAD_SNAPSHOT'; snapshot: WorkspaceState };

function isPinnableNodeType(type: WorkspaceNode['type']): boolean {
  return type === 'data';
}

/** Data widgets default to the dashboard; answers are never pinned. */
function normalizeDashboardPinIds(
  dashboardNodeIds: string[],
  nodes: WorkspaceNode[]
): string[] {
  const dataIds = new Set(nodes.filter((n) => n.type === 'data').map((n) => n.id));
  const ids = new Set(dashboardNodeIds.filter((id) => dataIds.has(id)));
  for (const id of dataIds) ids.add(id);
  return Array.from(ids);
}

const initialState: WorkspaceState = {
  keyword: '',
  goal: 'learn',
  context: undefined,
  nodes: [],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 0.75 },
  selectedNodeIds: [],
  dashboardNodeIds: [],
  collapsedNodeIds: [],
};

function reducer(state: WorkspaceState, action: Action): WorkspaceState {
  switch (action.type) {
    case 'INIT_WORKSPACE': {
      const { nodes, edges } = buildInitialWorkspace(action.keyword, action.goal, action.context);
      return {
        ...state,
        keyword: action.keyword,
        goal: action.goal,
        context: action.context,
        nodes,
        edges,
        viewport: { x: 120, y: 80, zoom: 0.72 },
        collapsedNodeIds: [],
        selectedNodeIds: [],
      };
    }
    case 'SET_SEED_QUERIES': {
      const root = state.nodes.find((n) => n.type === 'root');
      if (!root) return state;

      const alreadyHas = state.edges.some((e) => {
        if (e.sourceId !== root.id) return false;
        const t = state.nodes.find((n) => n.id === e.targetId);
        return t?.type === 'query';
      });
      if (alreadyHas) return state;

      const questions = action.questions
        .map((q) => q.trim())
        .filter(Boolean)
        .slice(0, 6);
      if (questions.length === 0) return state;

      const rh = Math.max(root.height ?? 0, estimateRootContentHeightPx());
      const rw = root.width ?? 260;
      const slotW = LAYOUT_QUERY_SIBLING_X;
      const rowY =
        root.position.y + rh + NODE_CANVAS_TOOLBAR_HEIGHT_PX + LAYOUT_GAP_Y;
      const totalW = questions.length * slotW;
      const startX = root.position.x + rw / 2 - totalW / 2;
      const ts = Date.now();

      const newNodes: WorkspaceNode[] = questions.map((q, i) => ({
        id: `q-seed-${i}-${ts}`,
        type: 'query' as const,
        question: q,
        parentId: root.id,
        position: { x: startX + i * slotW, y: rowY },
        status: 'suggested' as const,
        width: 280,
        height: 100,
      }));

      const newEdges: Edge[] = newNodes.map((n) => ({
        id: `e-root-${n.id}`,
        sourceId: root.id,
        targetId: n.id,
      }));

      return {
        ...state,
        nodes: [...state.nodes, ...newNodes],
        edges: [...state.edges, ...newEdges],
      };
    }
    case 'UPDATE_NODE': {
      return {
        ...state,
        nodes: state.nodes.map((n) =>
          n.id === action.id ? ({ ...n, ...action.updates } as WorkspaceNode) : n
        ),
      };
    }
    case 'ADD_NODE': {
      const node = action.node;
      const dashboardNodeIds =
        isPinnableNodeType(node.type) && !state.dashboardNodeIds.includes(node.id)
          ? [...state.dashboardNodeIds, node.id]
          : state.dashboardNodeIds;
      return { ...state, nodes: [...state.nodes, node], dashboardNodeIds };
    }
    case 'ADD_EDGE': {
      return { ...state, edges: [...state.edges, action.edge] };
    }
    case 'DELETE_TEMPLATE_SLOT': {
      const slotId = action.slotId;
      const slot = state.nodes.find((n) => n.id === slotId);
      if (!slot || slot.type !== 'template-slot') return state;
      const nextEdges = state.edges.filter(
        (e) => e.sourceId !== slotId && e.targetId !== slotId
      );
      return {
        ...state,
        nodes: state.nodes.filter((n) => n.id !== slotId),
        edges: nextEdges,
        dashboardNodeIds: state.dashboardNodeIds.filter((id) => id !== slotId),
        selectedNodeIds: state.selectedNodeIds.filter((id) => id !== slotId),
        collapsedNodeIds: state.collapsedNodeIds.filter((cid) => cid !== slotId),
      };
    }
    case 'SET_VIEWPORT': {
      return { ...state, viewport: { ...state.viewport, ...action.viewport } };
    }
    case 'SET_SELECTED_NODES': {
      const seen = new Set<string>();
      const ids = action.ids.filter((id) => {
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      });
      return { ...state, selectedNodeIds: ids };
    }
    case 'EXPAND_TO_SHOW_NODE': {
      const ancestors = findIncomingAncestorIds(action.nodeId, state.edges);
      const drop = new Set(ancestors);
      return {
        ...state,
        collapsedNodeIds: state.collapsedNodeIds.filter((id) => !drop.has(id)),
      };
    }
    case 'TOGGLE_DASHBOARD_PIN': {
      const node = state.nodes.find((n) => n.id === action.id);
      if (!node || node.type !== 'data') return state;
      const pinned = state.dashboardNodeIds.includes(action.id)
        ? state.dashboardNodeIds.filter((id) => id !== action.id)
        : [...state.dashboardNodeIds, action.id];
      return { ...state, dashboardNodeIds: pinned };
    }
    case 'MOVE_NODE': {
      return {
        ...state,
        nodes: state.nodes.map((n) =>
          n.id === action.id ? { ...n, position: action.position } : n
        ),
      };
    }
    case 'MOVE_NODES': {
      const posById = new Map(action.updates.map((u) => [u.id, u.position]));
      return {
        ...state,
        nodes: state.nodes.map((n) => {
          const p = posById.get(n.id);
          return p ? { ...n, position: p } : n;
        }),
      };
    }
    case 'TOGGLE_COLLAPSE_BRANCH': {
      const id = action.nodeId;
      const set = new Set(state.collapsedNodeIds);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...state, collapsedNodeIds: Array.from(set) };
    }
    case 'CLEAR_QUERY_SUBTREE': {
      const collectDescendants = (id: string, nodes: WorkspaceNode[]): string[] => {
        const children = nodes.filter((n) => n.parentId === id).map((n) => n.id);
        return [id, ...children.flatMap((cid) => collectDescendants(cid, nodes))];
      };
      const qid = action.queryId;
      const childRoots = state.nodes.filter((n) => n.parentId === qid).map((n) => n.id);
      const toDelete = new Set<string>();
      for (const rid of childRoots) {
        for (const id of collectDescendants(rid, state.nodes)) {
          toDelete.add(id);
        }
      }
      return {
        ...state,
        nodes: state.nodes
          .filter((n) => !toDelete.has(n.id))
          .map((n) =>
            n.id === qid && n.type === 'query' ? { ...n, status: 'suggested' as const } : n
          ),
        edges: state.edges.filter(
          (e) => !toDelete.has(e.sourceId) && !toDelete.has(e.targetId)
        ),
        dashboardNodeIds: state.dashboardNodeIds.filter((id) => !toDelete.has(id)),
        selectedNodeIds: state.selectedNodeIds.filter((id) => !toDelete.has(id)),
        collapsedNodeIds: state.collapsedNodeIds.filter((cid) => !toDelete.has(cid)),
      };
    }
    case 'DELETE_NODE': {
      // Collect the node and all its descendants recursively
      const collectDescendants = (id: string, nodes: WorkspaceNode[]): string[] => {
        const children = nodes.filter((n) => n.parentId === id).map((n) => n.id);
        return [id, ...children.flatMap((cid) => collectDescendants(cid, nodes))];
      };
      const target = state.nodes.find((n) => n.id === action.id);
      const toDelete = new Set(collectDescendants(action.id, state.nodes));
      if (target?.type === 'query-template') {
        for (const n of state.nodes) {
          if (n.type === 'template-slot' && n.templateNodeId === target.id) {
            toDelete.add(n.id);
          }
        }
      }
      return {
        ...state,
        nodes: state.nodes.filter((n) => !toDelete.has(n.id)),
        edges: state.edges.filter(
          (e) => !toDelete.has(e.sourceId) && !toDelete.has(e.targetId)
        ),
        dashboardNodeIds: state.dashboardNodeIds.filter((id) => !toDelete.has(id)),
        selectedNodeIds: state.selectedNodeIds.filter((id) => !toDelete.has(id)),
        collapsedNodeIds: state.collapsedNodeIds.filter((cid) => !toDelete.has(cid)),
      };
    }
    case 'AUTO_LAYOUT': {
      const edges = normalizeTemplateSlotGraph(state.nodes, state.edges);
      const measured = action.measuredHeights;
      const nodesForLayout = measured
        ? state.nodes.map((n) => {
            const mh = measured[n.id];
            if (mh != null && mh > 0) return { ...n, height: mh };
            if (n.type === 'root' || n.type === 'query') {
              const { height: _drop, ...rest } = n;
              return rest as WorkspaceNode;
            }
            return n;
          })
        : state.nodes;
      const layoutedNodes = computeTreeAwareLayout(nodesForLayout, edges, measured);
      return {
        ...state,
        edges,
        nodes: layoutedNodes,
      };
    }
    case 'LOAD_SNAPSHOT': {
      const s = action.snapshot;
      const edges = normalizeTemplateSlotGraph(s.nodes, s.edges);
      return {
        ...initialState,
        keyword: s.keyword,
        goal: s.goal,
        context: s.context,
        nodes: s.nodes,
        edges,
        viewport: s.viewport,
        selectedNodeIds: [],
        dashboardNodeIds: normalizeDashboardPinIds(s.dashboardNodeIds, s.nodes),
        collapsedNodeIds: s.collapsedNodeIds,
      };
    }
    default:
      return state;
  }
}

/* ─────────────────────────────────────────────
   Context
───────────────────────────────────────────── */
interface WorkspaceContextValue {
  state: WorkspaceState;
  dispatch: React.Dispatch<Action>;
  aiCatalog: AiModelCatalog | null;
  initWorkspace: (keyword: string, goal: GoalType, context?: string) => void;
  runQuery: (queryId: string) => void;
  addCustomQuery: (
    question: string,
    parentId: string,
    parentPos: Position,
    modelChoice?: string,
    toolChoice?: QueryToolChoice,
    autoRun?: boolean
  ) => string;
  toggleDashboardPin: (nodeId: string) => void;
  deleteNode: (nodeId: string) => void;
  /** Re-run metadata extraction (keywords, follow-ups, optional data widget) for a completed answer. */
  refreshAnswerMetadata: (answerId: string) => Promise<void>;
  autoLayout: () => void;
  isDemoMode: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export interface DemoResponse {
  content: string;
  extractedKeywords?: string[];
  suggestedQueries?: string[];
  dataNode?: Record<string, unknown> | null;
}

function normalizeDemoKey(input: string): string {
  return input.replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Match suggested / custom questions for duplicate detection under the same parent. */
function normalizeQueryKeyForDedupe(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

function findExistingChildQueryId(
  parentId: string,
  question: string,
  nodes: WorkspaceNode[]
): string | null {
  const key = normalizeQueryKeyForDedupe(question);
  if (!key) return null;
  for (const n of nodes) {
    if (n.type !== 'query') continue;
    if (n.parentId !== parentId) continue;
    if (normalizeQueryKeyForDedupe(n.question) === key) return n.id;
  }
  return null;
}

function buildAncestorContextPairs(nodes: WorkspaceNode[], queryId: string): Array<{ question: string; answer: string }> {
  const nodeById = new Map(nodes.map((n) => [n.id, n] as const));
  const lineageQueries: string[] = [];
  let cursor = nodeById.get(queryId)?.parentId;
  while (cursor) {
    const node = nodeById.get(cursor);
    if (!node) break;
    if (node.type === 'query') lineageQueries.push(node.id);
    cursor = node.parentId;
  }
  lineageQueries.reverse();
  return lineageQueries
    .map((qid) => {
      const q = nodeById.get(qid);
      if (!q || q.type !== 'query') return null;
      const a = nodes.find((n): n is AnswerNodeData => n.type === 'answer' && n.queryId === qid && !!n.content.trim());
      if (!a) return null;
      return { question: q.question, answer: a.content.trim() };
    })
    .filter((x): x is { question: string; answer: string } => !!x)
    .slice(-10);
}

export const FOCUS_QUERY_NODE_EVENT = 'qx10:focus-query-node';

function emitFocusQueryNode(queryId: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(FOCUS_QUERY_NODE_EVENT, { detail: { queryId } }));
}

export function WorkspaceProvider({
  children,
  demoResponses,
}: {
  children: ReactNode;
  demoResponses?: Record<string, DemoResponse>;
}) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [aiCatalog, setAiCatalog] = React.useState<AiModelCatalog | null>(null);
  const autosaveTimerRef = React.useRef<number | null>(null);
  const demoResponsesRef = React.useRef<Record<string, DemoResponse>>({});

  React.useEffect(() => {
    const next = demoResponses ?? {};
    const normalized: Record<string, DemoResponse> = {};
    for (const [k, v] of Object.entries(next)) {
      normalized[normalizeDemoKey(k)] = v;
    }
    demoResponsesRef.current = normalized;
  }, [demoResponses]);

  React.useEffect(() => {
    let cancelled = false;
    fetch('/api/workspace/models')
      .then((r) => r.json())
      .then((data: AiModelCatalog) => {
        if (!cancelled && data?.options) {
          setAiCatalog({
            defaultChoice: data.defaultChoice ?? '',
            options: data.options ?? [],
          });
        }
      })
      .catch(() => {
        if (!cancelled) setAiCatalog({ defaultChoice: '', options: [] });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Stable ref to always-current nodes, avoiding stale closure in runQuery
  const nodesRef = React.useRef(state.nodes);
  const edgesRef = React.useRef(state.edges);
  const keywordRef = React.useRef(state.keyword);
  const goalRef = React.useRef(state.goal);
  const contextRef = React.useRef(state.context);
  React.useEffect(() => {
    nodesRef.current = state.nodes;
  }, [state.nodes]);
  React.useEffect(() => {
    edgesRef.current = state.edges;
  }, [state.edges]);
  React.useEffect(() => {
    keywordRef.current = state.keyword;
    goalRef.current = state.goal;
    contextRef.current = state.context;
  }, [state.keyword, state.goal, state.context]);

  React.useEffect(() => {
    if (!state.keyword.trim()) return;
    if (autosaveTimerRef.current != null) {
      window.clearTimeout(autosaveTimerRef.current);
    }
    // Autosave workspace to server (debounced).
    autosaveTimerRef.current = window.setTimeout(() => {
      void saveWorkspaceToServer(state);
      autosaveTimerRef.current = null;
    }, 450);
    return () => {
      if (autosaveTimerRef.current != null) {
        window.clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [state]);

  const autoLayout = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const measuredHeights = measureWorkspaceNodeContentHeights();
        dispatch({ type: 'AUTO_LAYOUT', measuredHeights });
      });
    });
  }, []);

  const initWorkspace = useCallback(
    (keyword: string, goal: GoalType, context?: string) => {
      dispatch({ type: 'INIT_WORKSPACE', keyword, goal, context });
    },
    []
  );

  const runQuery = useCallback((queryId: string) => {
    const queryNode0 = nodesRef.current.find((n) => n.id === queryId);
    if (!queryNode0 || queryNode0.type !== 'query') return;
    if (queryNode0.status === 'running') return;

    if (queryNode0.status === 'complete') {
      dispatch({ type: 'CLEAR_QUERY_SUBTREE', queryId });
    }

    const queryNode =
      queryNode0.status === 'complete' ? { ...queryNode0, status: 'suggested' as const } : queryNode0;

    if (queryNode.status !== 'suggested' && queryNode.status !== 'idle') return;

    dispatch({
      type: 'UPDATE_NODE',
      id: queryId,
      updates: { status: 'running' },
    });

    const answerId = `ans-${queryId}-${Date.now()}`;
    const dataId = `data-${queryId}-${Date.now()}`;
    const queryH = queryNode.height ?? LAYOUT_DEFAULT_HEIGHT.query;
    const answerPos: Position = {
      x: queryNode.position.x,
      y:
        queryNode.position.y +
        NODE_CANVAS_TOOLBAR_HEIGHT_PX +
        queryH +
        LAYOUT_GAP_Y,
    };

    const runMockFlow = (mockData: ReturnType<typeof getMockResponse>) => {
      setTimeout(() => {
        dispatch({ type: 'UPDATE_NODE', id: queryId, updates: { status: 'complete' } });

        const answerNode: AnswerNodeData = {
          id: answerId,
          type: 'answer',
          queryId,
          parentId: queryId,
          position: answerPos,
          status: 'streaming',
          content: mockData.content,
          streamedChars: 0,
          extractedKeywords: mockData.extractedKeywords,
          suggestedQueries: mockData.suggestedQueries,
          width: 320,
          height: CANVAS_ANSWER_LAYOUT_HEIGHT,
        };
        dispatch({ type: 'ADD_NODE', node: answerNode });
        dispatch({
          type: 'ADD_EDGE',
          edge: { id: `e-${queryId}-${answerId}`, sourceId: queryId, targetId: answerId },
        });

        const totalChars = mockData.content.length;
        const chunkSize = 14;
        let streamed = 0;
        const interval = setInterval(() => {
          streamed = Math.min(streamed + chunkSize, totalChars);
          dispatch({
            type: 'UPDATE_NODE',
            id: answerId,
            updates: { streamedChars: streamed },
          });
          if (streamed >= totalChars) {
            clearInterval(interval);
            dispatch({ type: 'UPDATE_NODE', id: answerId, updates: { status: 'complete' } });

            const dn0 = mockData.dataNodes?.[0];
            const dataPayload = dn0
              ? ({
                  dataType: dn0.dataType,
                  title: dn0.title,
                  subtitle: dn0.subtitle,
                  tableColumns: dn0.tableColumns,
                  tableRows: dn0.tableRows,
                  chartData: dn0.chartData,
                  metrics: dn0.metrics,
                  listItems: dn0.listItems,
                } as Record<string, unknown>)
              : null;

            attachAnswerChildren(dispatch, {
              answerId,
              answerPos,
              dataId,
              dataPayload,
            });
          }
        }, 28);
      }, 400);
    };

    const runDemoFlow = (demo: DemoResponse) => {
      setTimeout(() => {
        dispatch({ type: 'UPDATE_NODE', id: queryId, updates: { status: 'complete' } });

        const answerNode: AnswerNodeData = {
          id: answerId,
          type: 'answer',
          queryId,
          parentId: queryId,
          position: answerPos,
          status: 'streaming',
          content: demo.content,
          streamedChars: 0,
          extractedKeywords: demo.extractedKeywords ?? [],
          suggestedQueries: demo.suggestedQueries ?? [],
          width: 320,
          height: CANVAS_ANSWER_LAYOUT_HEIGHT,
        };
        dispatch({ type: 'ADD_NODE', node: answerNode });
        dispatch({
          type: 'ADD_EDGE',
          edge: { id: `e-${queryId}-${answerId}`, sourceId: queryId, targetId: answerId },
        });

        const totalChars = demo.content.length;
        const chunkSize = 18;
        let streamed = 0;
        const interval = setInterval(() => {
          streamed = Math.min(streamed + chunkSize, totalChars);
          dispatch({
            type: 'UPDATE_NODE',
            id: answerId,
            updates: { streamedChars: streamed },
          });
          if (streamed >= totalChars) {
            clearInterval(interval);
            dispatch({ type: 'UPDATE_NODE', id: answerId, updates: { status: 'complete' } });
            attachAnswerChildren(dispatch, {
              answerId,
              answerPos,
              dataId,
              dataPayload: demo.dataNode ?? null,
            });
          }
        }, 22);
      }, 280);
    };

    const normalizedQuestion = normalizeDemoKey(queryNode.question);
    const demoByQueryId = demoResponsesRef.current[normalizeDemoKey(queryId)];
    const demoByQuestion = demoResponsesRef.current[normalizedQuestion];
    const demo = demoByQueryId ?? demoByQuestion;
    const hasDemoMode = Object.keys(demoResponsesRef.current).length > 0;
    if (demo) {
      runDemoFlow(demo);
      return;
    }
    if (hasDemoMode) {
      runMockFlow(getMockResponse(queryNode.question));
      return;
    }

    const runLiveAi = async () => {
      const contextPairs = buildAncestorContextPairs(nodesRef.current, queryId);

      let answerNodeCreated = false;
      const ensureAnswerNode = () => {
        if (answerNodeCreated) return;
        const emptyAnswer: AnswerNodeData = {
          id: answerId,
          type: 'answer',
          queryId,
          parentId: queryId,
          position: answerPos,
          status: 'streaming',
          content: '',
          streamedChars: 0,
          extractedKeywords: [],
          suggestedQueries: [],
          width: 320,
          height: CANVAS_ANSWER_LAYOUT_HEIGHT,
        };
        dispatch({ type: 'ADD_NODE', node: emptyAnswer });
        dispatch({
          type: 'ADD_EDGE',
          edge: { id: `e-${queryId}-${answerId}`, sourceId: queryId, targetId: answerId },
        });
        answerNodeCreated = true;
      };

      let content = '';
      let metaPayload: Record<string, unknown> | null = null;
      let suggested: string[] = [];
      let doneReceived = false;
      let streamFailed = false;

      const finalizeSuccess = () => {
        dispatch({ type: 'UPDATE_NODE', id: queryId, updates: { status: 'complete' } });
        dispatch({
          type: 'UPDATE_NODE',
          id: answerId,
          updates: {
            status: 'complete',
            streamedChars: content.length,
          },
        });
        attachAnswerChildren(dispatch, {
          answerId,
          answerPos,
          dataId,
          dataPayload: metaPayload,
        });
      };

      let res: Response;
      try {
        res = await fetch('/api/workspace/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: queryNode.question,
            keyword: keywordRef.current,
            goal: goalRef.current,
            context: contextRef.current ?? null,
            contextPairs,
            modelChoice: queryNode.modelChoice ?? null,
            toolChoice: queryNode.toolChoice ?? 'auto',
            locale: readLocaleForAi(),
          }),
        });
      } catch {
        toast.error(tr('ai.networkError'));
        dispatch({ type: 'UPDATE_NODE', id: queryId, updates: { status: 'suggested' } });
        return;
      }

      if (res.status === 503) {
        const errBody = (await res.json().catch(() => ({}))) as {
          code?: string;
          error?: string;
        };
        if (errBody.code === 'NO_API_KEY' || errBody.code === 'NO_AI_CONFIGURED') {
          toast.info(tr('ai.demoMode'), {
            duration: 6000,
          });
          runMockFlow(getMockResponse(queryNode.question));
          return;
        }
        toast.error(errBody.error || tr('ai.serviceUnavailable'));
        dispatch({ type: 'UPDATE_NODE', id: queryId, updates: { status: 'suggested' } });
        return;
      }

      if (!res.ok) {
        toast.error(tr('ai.requestFailed', { status: res.status }));
        dispatch({ type: 'UPDATE_NODE', id: queryId, updates: { status: 'suggested' } });
        return;
      }
      if (!res.body) {
        toast.error(tr('ai.emptyResponse'));
        dispatch({ type: 'UPDATE_NODE', id: queryId, updates: { status: 'suggested' } });
        return;
      }
      ensureAnswerNode();

      await consumeWorkspaceQueryStream(res, {
        onToken: (text) => {
          content += text;
          dispatch({
            type: 'UPDATE_NODE',
            id: answerId,
            updates: {
              content,
              streamedChars: content.length,
            },
          });
        },
        onMetadata: (m) => {
          suggested = m.suggestedQueries;
          dispatch({
            type: 'UPDATE_NODE',
            id: answerId,
            updates: {
              extractedKeywords: m.extractedKeywords,
              suggestedQueries: m.suggestedQueries,
            },
          });
          metaPayload = m.dataNode as Record<string, unknown> | null;
        },
        onDone: () => {
          doneReceived = true;
          finalizeSuccess();
        },
        onError: (msg) => {
          streamFailed = true;
          toast.error(msg);
          dispatch({ type: 'UPDATE_NODE', id: queryId, updates: { status: 'suggested' } });
          const fallback =
            content.trim().length > 0
              ? `${content.trim()}\n\n—\n${msg}`
              : `Something went wrong: ${msg}`;
          dispatch({
            type: 'UPDATE_NODE',
            id: answerId,
            updates: {
              status: 'complete',
              content: fallback,
              streamedChars: fallback.length,
            },
          });
        },
      });

      if (!doneReceived && !streamFailed && content.length > 0) {
        finalizeSuccess();
      }
    };

    void runLiveAi();
  }, [aiCatalog]);

  const addQueryTemplateNode = useCallback(
    ({
      displayName,
      pattern,
      position,
      toolChoice,
      followUpQuestions,
    }: {
      displayName: string;
      pattern: string;
      position: Position;
      toolChoice?: QueryToolChoice;
      followUpQuestions?: string[];
    }) => {
      const id = `qt-node-${Date.now()}`;
      const fus = (followUpQuestions ?? []).map((s) => s.trim()).filter(Boolean);
      const node: WorkspaceNode = {
        id,
        type: 'query-template',
        templateName: displayName.trim() || 'Template',
        pattern,
        position,
        status: 'suggested',
        width: 300,
        height: LAYOUT_DEFAULT_HEIGHT['query-template'],
        toolChoice: toolChoice ?? 'auto',
        ...(fus.length > 0 ? { followUpQuestions: fus } : {}),
      } as QueryTemplateNodeData;
      dispatch({ type: 'ADD_NODE', node });
    },
    []
  );

  const addTemplateSlotNode = useCallback((templateNodeId: string): string | null => {
    const nodes = nodesRef.current;
    const tpl = nodes.find(
      (n): n is QueryTemplateNodeData =>
        n.id === templateNodeId && n.type === 'query-template'
    );
    if (!tpl) return null;

    const keys = parseTemplateVariableKeys(tpl.pattern);
    const values =
      keys.length > 0
        ? (Object.fromEntries(keys.map((k) => [k, ''])) as Record<string, string>)
        : {};
    const slotId = `tpl-slot-${Date.now()}`;
    const slotH = estimateTemplateSlotHeight(keys.length);
    const slotW = tpl.width ?? 300;

    const slotNode: WorkspaceNode = {
      id: slotId,
      type: 'template-slot',
      templateNodeId,
      values,
      position: { x: tpl.position.x, y: tpl.position.y },
      status: 'suggested',
      width: slotW,
      height: slotH,
    };

    dispatch({ type: 'ADD_NODE', node: slotNode });
    dispatch({
      type: 'ADD_EDGE',
      edge: {
        id: `e-${slotId}-${templateNodeId}`,
        sourceId: slotId,
        targetId: templateNodeId,
      },
    });

    autoLayout();
    return slotId;
  }, [autoLayout]);

  const deleteTemplateSlotNode = useCallback((slotNodeId: string) => {
    const slot = nodesRef.current.find(
      (n): n is TemplateSlotNodeData =>
        n.id === slotNodeId && n.type === 'template-slot'
    );
    if (slot?.linkedQueryId) {
      dispatch({ type: 'DELETE_NODE', id: slot.linkedQueryId });
    }
    dispatch({ type: 'DELETE_TEMPLATE_SLOT', slotId: slotNodeId });
    autoLayout();
  }, [autoLayout]);

  const runTemplateSlot = useCallback(
    (slotNodeId: string) => {
      const nodes = nodesRef.current;
      const slot = nodes.find(
        (n): n is TemplateSlotNodeData =>
          n.id === slotNodeId && n.type === 'template-slot'
      );
      if (!slot) return;
      const tpl = nodes.find(
        (n): n is QueryTemplateNodeData =>
          n.id === slot.templateNodeId && n.type === 'query-template'
      );
      if (!tpl) return;

      const keys = parseTemplateVariableKeys(tpl.pattern);
      if (keys.length > 0) {
        const missing = keys.some((k) => !(slot.values[k] ?? '').trim());
        if (missing) {
          toast.error(tr('templates.slotFillRequired'));
          return;
        }
      } else if (!tpl.pattern.trim()) {
        return;
      }

      const question = substituteTemplate(tpl.pattern, slot.values);
      if (!question.trim()) {
        toast.error(tr('templates.slotFillRequired'));
        return;
      }

      if (slot.linkedQueryId) {
        dispatch({ type: 'DELETE_NODE', id: slot.linkedQueryId });
      }

      const tplH = tpl.height ?? LAYOUT_DEFAULT_HEIGHT['query-template'];
      const queryY =
        tpl.position.y + NODE_CANVAS_TOOLBAR_HEIGHT_PX + tplH + LAYOUT_GAP_Y;
      const queryId = `q-tpl-${tpl.id}-${slot.id}-${Date.now()}`;

      const queryNode: WorkspaceNode = {
        id: queryId,
        type: 'query',
        question,
        parentId: tpl.id,
        position: { x: tpl.position.x, y: queryY },
        status: 'suggested',
        width: 280,
        height: 100,
        isCustom: true,
        ...(tpl.modelChoice ? { modelChoice: tpl.modelChoice } : {}),
        ...(tpl.toolChoice ? { toolChoice: tpl.toolChoice } : {}),
      } as WorkspaceNode;

      dispatch({ type: 'ADD_NODE', node: queryNode });
      dispatch({
        type: 'ADD_EDGE',
        edge: { id: `e-${tpl.id}-${queryId}`, sourceId: tpl.id, targetId: queryId },
      });
      dispatch({
        type: 'UPDATE_NODE',
        id: slotNodeId,
        updates: { linkedQueryId: queryId } as Partial<WorkspaceNode>,
      });

      autoLayout();

      // Wait until the new query node is reflected in nodesRef.
      const tryRun = (attempt = 0) => {
        const exists = nodesRef.current.some((n) => n.id === queryId && n.type === 'query');
        if (exists) {
          runQuery(queryId);
          return;
        }
        if (attempt >= 8) return;
        window.setTimeout(() => tryRun(attempt + 1), 25);
      };
      window.setTimeout(() => tryRun(0), 0);
    },
    [runQuery, autoLayout]
  );

  const addCustomQuery = useCallback(
    (
      question: string,
      parentId: string,
      parentPos: Position,
      modelChoice?: string,
      toolChoice?: QueryToolChoice,
      autoRun = false
    ): string => {
      const existingId = findExistingChildQueryId(parentId, question, nodesRef.current);
      if (existingId) {
        emitFocusQueryNode(existingId);
        return existingId;
      }

      const parent = nodesRef.current.find((n) => n.id === parentId);
      let dy = 160;
      if (parent?.type === 'root') {
        const ph = parent.height ?? estimateRootContentHeightPx();
        dy = NODE_CANVAS_TOOLBAR_HEIGHT_PX + ph + LAYOUT_GAP_Y;
      } else if (parent?.type === 'answer') {
        const ph = parent.height ?? CANVAS_ANSWER_LAYOUT_HEIGHT;
        dy = NODE_CANVAS_TOOLBAR_HEIGHT_PX + ph + LAYOUT_GAP_Y;
      } else if (parent?.type === 'query') {
        const ph = parent.height ?? LAYOUT_DEFAULT_HEIGHT.query;
        dy = NODE_CANVAS_TOOLBAR_HEIGHT_PX + ph + LAYOUT_GAP_Y;
      }

      const customQId = `q-custom-${Date.now()}`;
      const customNode: WorkspaceNode = {
        id: customQId,
        type: 'query',
        question,
        parentId,
        position: { x: parentPos.x, y: parentPos.y + dy },
        status: 'suggested',
        width: 280,
        height: 100,
        isCustom: true,
        ...(modelChoice ? { modelChoice } : {}),
        ...(toolChoice ? { toolChoice } : {}),
      } as WorkspaceNode;
      dispatch({ type: 'ADD_NODE', node: customNode });
      dispatch({
        type: 'ADD_EDGE',
        edge: { id: `e-${parentId}-${customQId}`, sourceId: parentId, targetId: customQId },
      });
      if (autoRun) {
        const tryRun = (attempt = 0) => {
          const exists = nodesRef.current.some((n) => n.id === customQId && n.type === 'query');
          if (exists) {
            runQuery(customQId);
            return;
          }
          if (attempt >= 8) return;
          window.setTimeout(() => tryRun(attempt + 1), 25);
        };
        window.setTimeout(() => tryRun(0), 0);
      }
      return customQId;
    },
    [runQuery]
  );

  const toggleDashboardPin = useCallback((nodeId: string) => {
    dispatch({ type: 'TOGGLE_DASHBOARD_PIN', id: nodeId });
  }, []);

  const deleteNode = useCallback((nodeId: string) => {
    dispatch({ type: 'DELETE_NODE', id: nodeId });
  }, []);

  const refreshAnswerMetadata = useCallback(async (answerId: string) => {
    if (Object.keys(demoResponsesRef.current).length > 0) {
      toast.message(tr('nodes.refreshMetaDemoDisabled'));
      return;
    }
    const nodes = nodesRef.current;
    const answer = nodes.find((n): n is AnswerNodeData => n.id === answerId && n.type === 'answer');
    if (!answer || answer.status !== 'complete' || !answer.content.trim()) return;
    const query = nodes.find((n) => n.id === answer.queryId && n.type === 'query');
    if (!query || query.type !== 'query') return;

    const toastId = toast.loading(tr('nodes.refreshMetaRunning'));
    try {
      const res = await fetch('/api/workspace/extract-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: query.question,
          answer: answer.content,
          keyword: keywordRef.current,
          goal: goalRef.current,
          locale: readLocaleForAi(),
          modelChoice: query.modelChoice ?? null,
        }),
      });
      const data = (await res.json()) as {
        extractedKeywords?: string[];
        suggestedQueries?: string[];
        dataNode?: Record<string, unknown> | null;
        error?: string;
      };
      if (!res.ok || data.error) {
        toast.error(data.error || tr('ai.requestFailed', { status: res.status }), { id: toastId });
        return;
      }
      const extractedKeywords = Array.isArray(data.extractedKeywords) ? data.extractedKeywords : [];
      const mergedSuggested = mergeTemplateFollowUpsIntoSuggested(
        nodesRef.current,
        query.id,
        Array.isArray(data.suggestedQueries) ? data.suggestedQueries : []
      );
      dispatch({
        type: 'UPDATE_NODE',
        id: answerId,
        updates: {
          extractedKeywords,
          suggestedQueries: mergedSuggested,
        } as Partial<WorkspaceNode>,
      });

      const payload = data.dataNode;
      if (payload && typeof payload === 'object' && 'dataType' in payload && 'title' in payload) {
        const dataChild = nodesRef.current.find(
          (n): n is DataNodeData => n.type === 'data' && n.parentId === answerId
        );
        if (dataChild) {
          dispatch({
            type: 'UPDATE_NODE',
            id: dataChild.id,
            updates: {
              dataType: payload.dataType as DataNodeType,
              title: String(payload.title),
              subtitle: typeof payload.subtitle === 'string' ? payload.subtitle : undefined,
              tableColumns: Array.isArray(payload.tableColumns)
                ? (payload.tableColumns as string[])
                : undefined,
              tableRows: Array.isArray(payload.tableRows)
                ? (payload.tableRows as DataNodeData['tableRows'])
                : undefined,
              chartData: Array.isArray(payload.chartData)
                ? (payload.chartData as DataNodeData['chartData'])
                : undefined,
              metrics: Array.isArray(payload.metrics)
                ? (payload.metrics as DataNodeData['metrics'])
                : undefined,
              listItems: Array.isArray(payload.listItems)
                ? (payload.listItems as string[])
                : undefined,
              status: 'complete',
            } as Partial<WorkspaceNode>,
          });
        } else {
          const dataId = `data-${answer.queryId}-${Date.now()}`;
          attachAnswerChildren(dispatch, {
            answerId,
            answerPos: answer.position,
            dataId,
            dataPayload: payload as Record<string, unknown>,
          });
        }
      }
      toast.success(tr('nodes.refreshMetaDone'), { id: toastId });
    } catch {
      toast.error(tr('ai.networkError'), { id: toastId });
    }
  }, [dispatch]);

  const isDemoMode = Object.keys(demoResponsesRef.current).length > 0;

  return (
    <WorkspaceContext.Provider
      value={{
        state,
        dispatch,
        aiCatalog,
        initWorkspace,
        runQuery,
        addCustomQuery,
        toggleDashboardPin,
        deleteNode,
        refreshAnswerMetadata,
        autoLayout,
        isDemoMode,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used inside WorkspaceProvider');
  return ctx;
}
