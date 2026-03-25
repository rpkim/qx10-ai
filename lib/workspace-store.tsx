'use client';

import React, {
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
import { tr } from '@/lib/i18n/runtime';
import {
  saveWorkspaceToLocalStorage,
  normalizeTemplateSlotGraph,
} from './workspace-snapshot';

/* ─────────────────────────────────────────────
   Canvas layout (tree-aware — avoids Answer / Query overlap)
───────────────────────────────────────────── */

/** Vertical gap between parent bottom and child top */
const LAYOUT_GAP_Y = 108;
const LAYOUT_GAP_X = 64;
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
  'template-slot': 240,
  answer: CANVAS_ANSWER_LAYOUT_HEIGHT + LAYOUT_HEIGHT_BUFFER + 40,
  data: 320,
};

function estimateTemplateSlotHeight(keyCount: number): number {
  return Math.max(
    200,
    NODE_CANVAS_TOOLBAR_HEIGHT_PX + 80 + keyCount * 52 + 88 + LAYOUT_HEIGHT_BUFFER
  );
}

/**
 * Layout uses stored height when present; otherwise conservative estimates so
 * auto-layout does not place children inside underestimated parent boxes (overlap).
 */
function layoutNodeSize(n: WorkspaceNode): { w: number; h: number } {
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

  if (n.type === 'query') {
    h = Math.max(h, 320 + LAYOUT_HEIGHT_BUFFER);
  } else if (n.type === 'query-template') {
    const bodyGuess = NODE_CANVAS_TOOLBAR_HEIGHT_PX + 220 + LAYOUT_HEIGHT_BUFFER;
    h = Math.max(h, bodyGuess);
  } else if (n.type === 'template-slot') {
    h = Math.max(h, 200 + LAYOUT_HEIGHT_BUFFER);
  } else if (n.type === 'data') {
    h = Math.max(h, 320 + LAYOUT_HEIGHT_BUFFER);
  } else if (n.type === 'answer') {
    h = Math.max(h, CANVAS_ANSWER_LAYOUT_HEIGHT + LAYOUT_HEIGHT_BUFFER + 64);
  } else if (n.type === 'root') {
    h = Math.max(h, 100);
  }

  return { w, h };
}

function subtreeMaxRight(
  id: string,
  nodeMap: Map<string, WorkspaceNode>,
  childrenMap: Map<string, string[]>,
  positions: Map<string, Position>
): number {
  const n = nodeMap.get(id);
  if (!n) return 0;
  const pos = positions.get(id);
  if (!pos) return 0;
  const { w } = layoutNodeSize(n);
  let right = pos.x + w;
  for (const c of childrenMap.get(id) ?? []) {
    right = Math.max(right, subtreeMaxRight(c, nodeMap, childrenMap, positions));
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
function computeTreeAwareLayout(nodes: WorkspaceNode[], edges: Edge[]): WorkspaceNode[] {
  if (nodes.length === 0) return nodes;

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
    if (!bucket) return;
    bucket.push(e.targetId);
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
    const { w, h } = layoutNodeSize(n);
    positions.set(id, { x, y });

    const kids = childrenMap.get(id) ?? [];
    if (kids.length === 0) {
      return { bottom: y + h + chromeH, rightEdge: x + w };
    }

    if (n.type === 'root') {
      const rowY = y + h + chromeH + LAYOUT_GAP_Y;
      const slotW = Math.max(380, LAYOUT_QUERY_SIBLING_X);
      const totalW = kids.length * slotW;
      const startX = x + w / 2 - totalW / 2;
      let maxBottom = y + h + chromeH;
      let maxRight = x + w;
      kids.forEach((kidId, i) => {
        const box = layoutSubtree(kidId, startX + i * slotW, rowY);
        maxBottom = Math.max(maxBottom, box.bottom);
        maxRight = Math.max(maxRight, box.rightEdge);
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
      const colW = Math.max(380, LAYOUT_QUERY_SIBLING_X);
      if (queryKids.length > 0) {
        const totalW = queryKids.length * colW;
        const startX = x + w / 2 - totalW / 2;
        queryKids.forEach((kidId, i) => {
          const box = layoutSubtree(kidId, startX + i * colW, rowY);
          maxBottom = Math.max(maxBottom, box.bottom);
          rightEdge = Math.max(rightEdge, box.rightEdge);
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
      subtreeMaxRight(r.id, nodeMap, childrenMap, positions)
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
    const { w: tplW } = layoutNodeSize(tpl);
    const widths = slotIds.map((id) => layoutNodeSize(nodeMap.get(id)!).w);
    const heights = slotIds.map((id) => layoutNodeSize(nodeMap.get(id)!).h);
    const maxSlotH = Math.max(...heights);
    const gapX = LAYOUT_GAP_X;
    const totalW = widths.reduce((acc, w, i) => acc + w + (i > 0 ? gapX : 0), 0);
    const rowY = tplPos.y - chromeH - maxSlotH - LAYOUT_GAP_Y;
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
    queryId: string;
    answerId: string;
    answerPos: Position;
    suggestedQueries: string[];
    dataId: string;
    dataPayload: Record<string, unknown> | null | undefined;
    /** Copied to branched query nodes so they keep the same model. */
    parentModelChoice?: string;
    parentToolChoice?: QueryToolChoice;
  }
) {
  const {
    queryId,
    answerId,
    answerPos,
    suggestedQueries,
    dataId,
    dataPayload,
    parentModelChoice,
    parentToolChoice,
  } = opts;

  const built = dataNodeFromApiPayload(dataPayload, dataId, answerId, answerPos, 320);
  if (built) {
    dispatch({ type: 'ADD_NODE', node: built });
    dispatch({
      type: 'ADD_EDGE',
      edge: { id: `e-${answerId}-${dataId}`, sourceId: answerId, targetId: dataId },
    });
  }

  const followUpY =
    answerPos.y +
    NODE_CANVAS_TOOLBAR_HEIGHT_PX +
    CANVAS_ANSWER_LAYOUT_HEIGHT +
    LAYOUT_GAP_Y;
  suggestedQueries.slice(0, 2).forEach((q, i) => {
    const subQId = `q-sub-${queryId}-${i}-${Date.now()}`;
    const subQNode: WorkspaceNode = {
      id: subQId,
      type: 'query',
      question: q,
      parentId: answerId,
      position: {
        x: answerPos.x + i * LAYOUT_QUERY_SIBLING_X,
        y: followUpY,
      },
      status: 'suggested',
      width: 280,
      height: 100,
      ...(parentModelChoice ? { modelChoice: parentModelChoice } : {}),
      ...(parentToolChoice ? { toolChoice: parentToolChoice } : {}),
    };
    dispatch({ type: 'ADD_NODE', node: subQNode });
    dispatch({
      type: 'ADD_EDGE',
      edge: {
        id: `e-${answerId}-${subQId}`,
        sourceId: answerId,
        targetId: subQId,
      },
    });
  });
}

/* ─────────────────────────────────────────────
   Action types
───────────────────────────────────────────── */
type Action =
  | { type: 'INIT_WORKSPACE'; keyword: string; goal: GoalType }
  | { type: 'SET_SEED_QUERIES'; questions: string[] }
  | { type: 'UPDATE_NODE'; id: string; updates: Partial<WorkspaceNode> }
  | { type: 'ADD_NODE'; node: WorkspaceNode }
  | { type: 'ADD_EDGE'; edge: Edge }
  | { type: 'DELETE_TEMPLATE_SLOT'; slotId: string }
  | { type: 'SET_VIEWPORT'; viewport: Partial<Viewport> }
  | { type: 'SELECT_NODE'; id: string | null }
  | { type: 'TOGGLE_DASHBOARD_PIN'; id: string }
  | { type: 'MOVE_NODE'; id: string; position: Position }
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
  | { type: 'AUTO_LAYOUT' }
  | { type: 'LOAD_SNAPSHOT'; snapshot: WorkspaceState };

const initialState: WorkspaceState = {
  keyword: '',
  goal: 'learn',
  nodes: [],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 0.75 },
  selectedNodeId: null,
  dashboardNodeIds: [],
  collapsedNodeIds: [],
};

function reducer(state: WorkspaceState, action: Action): WorkspaceState {
  switch (action.type) {
    case 'INIT_WORKSPACE': {
      const { nodes, edges } = buildInitialWorkspace(action.keyword, action.goal);
      return {
        ...state,
        keyword: action.keyword,
        goal: action.goal,
        nodes,
        edges,
        viewport: { x: 120, y: 80, zoom: 0.72 },
        collapsedNodeIds: [],
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

      const rh = root.height ?? LAYOUT_DEFAULT_HEIGHT.root;
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
      return { ...state, nodes: [...state.nodes, action.node] };
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
        selectedNodeId: state.selectedNodeId === slotId ? null : state.selectedNodeId,
        collapsedNodeIds: state.collapsedNodeIds.filter((cid) => cid !== slotId),
      };
    }
    case 'SET_VIEWPORT': {
      return { ...state, viewport: { ...state.viewport, ...action.viewport } };
    }
    case 'SELECT_NODE': {
      return { ...state, selectedNodeId: action.id };
    }
    case 'TOGGLE_DASHBOARD_PIN': {
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
        selectedNodeId: toDelete.has(state.selectedNodeId ?? '') ? null : state.selectedNodeId,
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
        selectedNodeId: toDelete.has(state.selectedNodeId ?? '') ? null : state.selectedNodeId,
        collapsedNodeIds: state.collapsedNodeIds.filter((cid) => !toDelete.has(cid)),
      };
    }
    case 'AUTO_LAYOUT': {
      const edges = normalizeTemplateSlotGraph(state.nodes, state.edges);
      const layoutedNodes = computeTreeAwareLayout(state.nodes, edges);
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
        nodes: s.nodes,
        edges,
        viewport: s.viewport,
        selectedNodeId: null,
        dashboardNodeIds: s.dashboardNodeIds,
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
  initWorkspace: (keyword: string, goal: GoalType) => void;
  runQuery: (queryId: string) => void;
  addCustomQuery: (
    question: string,
    parentId: string,
    parentPos: Position,
    modelChoice?: string,
    toolChoice?: QueryToolChoice
  ) => void;
  addQueryTemplateNode: (args: {
    displayName: string;
    pattern: string;
    position: Position;
    toolChoice?: QueryToolChoice;
    followUpQuestions?: string[];
  }) => void;
  addTemplateSlotNode: (templateNodeId: string) => void;
  deleteTemplateSlotNode: (slotNodeId: string) => void;
  runTemplateSlot: (slotNodeId: string) => void;
  toggleDashboardPin: (nodeId: string) => void;
  deleteNode: (nodeId: string) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [aiCatalog, setAiCatalog] = React.useState<AiModelCatalog | null>(null);
  const autosaveTimerRef = React.useRef<number | null>(null);

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
  React.useEffect(() => {
    nodesRef.current = state.nodes;
  }, [state.nodes]);
  React.useEffect(() => {
    edgesRef.current = state.edges;
  }, [state.edges]);
  React.useEffect(() => {
    keywordRef.current = state.keyword;
    goalRef.current = state.goal;
  }, [state.keyword, state.goal]);

  React.useEffect(() => {
    if (!state.keyword.trim()) return;
    if (autosaveTimerRef.current != null) {
      window.clearTimeout(autosaveTimerRef.current);
    }
    // Default persistence until DB is added: autosave current workspace silently.
    autosaveTimerRef.current = window.setTimeout(() => {
      saveWorkspaceToLocalStorage(state);
      autosaveTimerRef.current = null;
    }, 450);
    return () => {
      if (autosaveTimerRef.current != null) {
        window.clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [state]);

  const initWorkspace = useCallback(
    (keyword: string, goal: GoalType) => {
      dispatch({ type: 'INIT_WORKSPACE', keyword, goal });
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
              queryId,
              answerId,
              answerPos,
              suggestedQueries: mergeTemplateFollowUpsIntoSuggested(
                nodesRef.current,
                queryId,
                mockData.suggestedQueries
              ),
              dataId,
              dataPayload,
              parentModelChoice: queryNode.modelChoice,
              parentToolChoice: queryNode.toolChoice,
            });
          }
        }, 28);
      }, 400);
    };

    const runLiveAi = async () => {
      let res: Response;
      try {
        res = await fetch('/api/workspace/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: queryNode.question,
            keyword: keywordRef.current,
            goal: goalRef.current,
            modelChoice: queryNode.modelChoice ?? null,
            toolChoice: queryNode.toolChoice ?? 'auto',
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
        const errText = await res.text().catch(() => '');
        toast.error(tr('ai.requestFailed', { status: res.status }));
        dispatch({ type: 'UPDATE_NODE', id: queryId, updates: { status: 'suggested' } });
        return;
      }

      if (!res.body) {
        toast.error(tr('ai.emptyResponse'));
        dispatch({ type: 'UPDATE_NODE', id: queryId, updates: { status: 'suggested' } });
        return;
      }

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

      let content = '';
      let metaPayload: Record<string, unknown> | null = null;
      let suggested: string[] = [];
      let doneReceived = false;
      let streamFailed = false;

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
            queryId,
            answerId,
            answerPos,
            suggestedQueries: mergeTemplateFollowUpsIntoSuggested(
              nodesRef.current,
              queryId,
              suggested.length ? suggested : ['What should I explore next?']
            ),
            dataId,
            dataPayload: metaPayload,
            parentModelChoice: queryNode.modelChoice,
            parentToolChoice: queryNode.toolChoice,
          });
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
        dispatch({ type: 'UPDATE_NODE', id: queryId, updates: { status: 'complete' } });
        dispatch({
          type: 'UPDATE_NODE',
          id: answerId,
          updates: { status: 'complete', streamedChars: content.length },
        });
        attachAnswerChildren(dispatch, {
          queryId,
          answerId,
          answerPos,
          suggestedQueries: mergeTemplateFollowUpsIntoSuggested(
            nodesRef.current,
            queryId,
            suggested.length ? suggested : ['What should I explore next?']
          ),
          dataId,
          dataPayload: metaPayload,
          parentModelChoice: queryNode.modelChoice,
          parentToolChoice: queryNode.toolChoice,
        });
      }
    };

    void runLiveAi();
  }, []);

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

  const addTemplateSlotNode = useCallback((templateNodeId: string) => {
    const nodes = nodesRef.current;
    const tpl = nodes.find(
      (n): n is QueryTemplateNodeData =>
        n.id === templateNodeId && n.type === 'query-template'
    );
    if (!tpl) return;

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

    dispatch({ type: 'AUTO_LAYOUT' });
  }, []);

  const deleteTemplateSlotNode = useCallback((slotNodeId: string) => {
    const slot = nodesRef.current.find(
      (n): n is TemplateSlotNodeData =>
        n.id === slotNodeId && n.type === 'template-slot'
    );
    if (slot?.linkedQueryId) {
      dispatch({ type: 'DELETE_NODE', id: slot.linkedQueryId });
    }
    dispatch({ type: 'DELETE_TEMPLATE_SLOT', slotId: slotNodeId });
    dispatch({ type: 'AUTO_LAYOUT' });
  }, []);

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

      dispatch({ type: 'AUTO_LAYOUT' });

      window.setTimeout(() => {
        runQuery(queryId);
      }, 0);
    },
    [runQuery]
  );

  const addCustomQuery = useCallback(
    (
      question: string,
      parentId: string,
      parentPos: Position,
      modelChoice?: string,
      toolChoice?: QueryToolChoice
    ) => {
      const parent = nodesRef.current.find((n) => n.id === parentId);
      let dy = 160;
      if (parent?.type === 'answer') {
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
    },
    []
  );

  const toggleDashboardPin = useCallback((nodeId: string) => {
    dispatch({ type: 'TOGGLE_DASHBOARD_PIN', id: nodeId });
  }, []);

  const deleteNode = useCallback((nodeId: string) => {
    dispatch({ type: 'DELETE_NODE', id: nodeId });
  }, []);

  return (
    <WorkspaceContext.Provider
      value={{
        state,
        dispatch,
        aiCatalog,
        initWorkspace,
        runQuery,
        addCustomQuery,
        addQueryTemplateNode,
        addTemplateSlotNode,
        deleteTemplateSlotNode,
        runTemplateSlot,
        toggleDashboardPin,
        deleteNode,
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
