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
} from './types';
import { toast } from 'sonner';
import { buildInitialWorkspace, getMockResponse } from './mock-data';
import { consumeWorkspaceQueryStream } from '@/lib/ai/consume-query-stream';
import { NODE_CANVAS_TOOLBAR_HEIGHT_PX } from './canvas-node-chrome';
import { tr } from '@/lib/i18n/runtime';
import { saveWorkspaceToLocalStorage } from './workspace-snapshot';

/* ─────────────────────────────────────────────
   Canvas layout (tree-aware — avoids Answer / Query overlap)
───────────────────────────────────────────── */

/** Vertical gap between parent bottom and child top */
const LAYOUT_GAP_Y = 56;
const LAYOUT_GAP_X = 48;
const LAYOUT_QUERY_SIBLING_X = 320;

/**
 * Estimated Answer card height for placement & auto-layout when DOM is unknown.
 * Keep in sync with typical Answer node (body + keywords + follow-ups).
 */
const CANVAS_ANSWER_LAYOUT_HEIGHT = 520;

const LAYOUT_DEFAULT_HEIGHT: Record<WorkspaceNode['type'], number> = {
  root: 90,
  query: 140,
  answer: CANVAS_ANSWER_LAYOUT_HEIGHT,
  data: 280,
};

function layoutNodeSize(n: WorkspaceNode): { w: number; h: number } {
  const w =
    n.width ?? (n.type === 'root' ? 260 : n.type === 'data' ? 320 : 280);
  const h = n.height ?? LAYOUT_DEFAULT_HEIGHT[n.type];
  return { w, h };
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
    childrenMap.get(e.sourceId)!.push(e.targetId);
  });

  const positions = new Map<string, Position>();

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
      const slotW = Math.max(300, LAYOUT_QUERY_SIBLING_X);
      const totalW = kids.length * slotW;
      const startX = x + w / 2 - totalW / 2;
      let maxBottom = y + h + chromeH;
      kids.forEach((kidId, i) => {
        const box = layoutSubtree(kidId, startX + i * slotW, rowY);
        maxBottom = Math.max(maxBottom, box.bottom);
      });
      return { bottom: maxBottom, rightEdge: x + w };
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
        qx += LAYOUT_QUERY_SIBLING_X;
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

  const roots = nodes.filter(
    (n) => n.type === 'root' || !edges.some((e) => e.targetId === n.id)
  );
  const root = roots.find((r) => r.type === 'root') ?? roots[0];
  if (!root) return nodes;

  layoutSubtree(root.id, root.position.x, root.position.y);

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
  | { type: 'SET_VIEWPORT'; viewport: Partial<Viewport> }
  | { type: 'SELECT_NODE'; id: string | null }
  | { type: 'TOGGLE_DASHBOARD_PIN'; id: string }
  | { type: 'MOVE_NODE'; id: string; position: Position }
  | { type: 'DELETE_NODE'; id: string }
  | { type: 'TOGGLE_COLLAPSE_BRANCH'; nodeId: string }
  | { type: 'RUN_QUERY'; queryId: string }
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
    case 'DELETE_NODE': {
      // Collect the node and all its descendants recursively
      const collectDescendants = (id: string, nodes: WorkspaceNode[]): string[] => {
        const children = nodes.filter((n) => n.parentId === id).map((n) => n.id);
        return [id, ...children.flatMap((cid) => collectDescendants(cid, nodes))];
      };
      const toDelete = new Set(collectDescendants(action.id, state.nodes));
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
      const layoutedNodes = computeTreeAwareLayout(state.nodes, state.edges);
      return {
        ...state,
        nodes: layoutedNodes,
      };
    }
    case 'LOAD_SNAPSHOT': {
      const s = action.snapshot;
      return {
        ...initialState,
        keyword: s.keyword,
        goal: s.goal,
        nodes: s.nodes,
        edges: s.edges,
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
  const keywordRef = React.useRef(state.keyword);
  const goalRef = React.useRef(state.goal);
  React.useEffect(() => {
    nodesRef.current = state.nodes;
  }, [state.nodes]);
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
    const queryNode = nodesRef.current.find((n) => n.id === queryId);
    if (!queryNode || queryNode.type !== 'query') return;
    if (queryNode.status === 'running' || queryNode.status === 'complete') return;

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
              suggestedQueries: mockData.suggestedQueries,
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
            suggestedQueries: suggested.length ? suggested : ['What should I explore next?'],
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
          suggestedQueries: suggested.length ? suggested : ['What should I explore next?'],
          dataId,
          dataPayload: metaPayload,
          parentModelChoice: queryNode.modelChoice,
          parentToolChoice: queryNode.toolChoice,
        });
      }
    };

    void runLiveAi();
  }, []);

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
