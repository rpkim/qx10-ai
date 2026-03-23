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
} from './types';
import { buildInitialWorkspace, getMockResponse, getSuggestedQueries } from './mock-data';

/* ─────────────────────────────────────────────
   Action types
───────────────────────────────────────────── */
type Action =
  | { type: 'INIT_WORKSPACE'; keyword: string; goal: GoalType }
  | { type: 'UPDATE_NODE'; id: string; updates: Partial<WorkspaceNode> }
  | { type: 'ADD_NODE'; node: WorkspaceNode }
  | { type: 'ADD_EDGE'; edge: Edge }
  | { type: 'SET_VIEWPORT'; viewport: Partial<Viewport> }
  | { type: 'SELECT_NODE'; id: string | null }
  | { type: 'TOGGLE_DASHBOARD_PIN'; id: string }
  | { type: 'MOVE_NODE'; id: string; position: Position }
  | { type: 'DELETE_NODE'; id: string }
  | { type: 'RUN_QUERY'; queryId: string }
  | {
      type: 'ANSWER_STREAMED';
      answerId: string;
      chars: number;
    }
  | { type: 'COMPLETE_ANSWER'; answerId: string };

const initialState: WorkspaceState = {
  keyword: '',
  goal: 'learn',
  nodes: [],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 0.75 },
  selectedNodeId: null,
  dashboardNodeIds: [],
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
  initWorkspace: (keyword: string, goal: GoalType) => void;
  runQuery: (queryId: string) => void;
  addCustomQuery: (question: string, parentId: string, parentPos: Position) => void;
  toggleDashboardPin: (nodeId: string) => void;
  deleteNode: (nodeId: string) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  // Stable ref to always-current nodes, avoiding stale closure in runQuery
  const nodesRef = React.useRef(state.nodes);
  React.useEffect(() => {
    nodesRef.current = state.nodes;
  }, [state.nodes]);

  const initWorkspace = useCallback(
    (keyword: string, goal: GoalType) => {
      dispatch({ type: 'INIT_WORKSPACE', keyword, goal });
    },
    []
  );

  const runQuery = useCallback(
    (queryId: string) => {
      const queryNode = nodesRef.current.find((n) => n.id === queryId);
      if (!queryNode || queryNode.type !== 'query') return;

      // Mark query as running
      dispatch({
        type: 'UPDATE_NODE',
        id: queryId,
        updates: { status: 'running' },
      });

      const mockData = getMockResponse(queryNode.question);
      const answerId = `ans-${queryId}-${Date.now()}`;
      const dataId = `data-${queryId}-${Date.now()}`;

      // Position answer below query
      const answerPos: Position = {
        x: queryNode.position.x,
        y: queryNode.position.y + 160,
      };

      // Simulate streaming delay
      setTimeout(() => {
        // Mark query complete
        dispatch({ type: 'UPDATE_NODE', id: queryId, updates: { status: 'complete' } });

        // Add answer node (streaming state)
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
          height: 280,
        };
        dispatch({ type: 'ADD_NODE', node: answerNode });
        dispatch({
          type: 'ADD_EDGE',
          edge: { id: `e-${queryId}-${answerId}`, sourceId: queryId, targetId: answerId },
        });

        // Simulate streaming text
        const totalChars = mockData.content.length;
        const chunkSize = 12;
        let streamed = 0;
        const interval = setInterval(() => {
          streamed = Math.min(streamed + chunkSize, totalChars);
          dispatch({ type: 'UPDATE_NODE', id: answerId, updates: { streamedChars: streamed } });
          if (streamed >= totalChars) {
            clearInterval(interval);
            dispatch({ type: 'UPDATE_NODE', id: answerId, updates: { status: 'complete' } });

            // Add data node(s) if available
            if (mockData.dataNodes && mockData.dataNodes.length > 0) {
              const dn = mockData.dataNodes[0];
              const dataNode: DataNodeData = {
                id: dataId,
                type: 'data',
                parentId: answerId,
                position: { x: answerPos.x + 360, y: answerPos.y },
                status: 'complete',
                dataType: dn.dataType || 'table',
                title: dn.title || 'Data',
                subtitle: dn.subtitle,
                tableColumns: dn.tableColumns,
                tableRows: dn.tableRows,
                chartData: dn.chartData,
                metrics: dn.metrics,
                listItems: dn.listItems,
                width: 320,
                height: 280,
              };
              dispatch({ type: 'ADD_NODE', node: dataNode });
              dispatch({
                type: 'ADD_EDGE',
                edge: { id: `e-${answerId}-${dataId}`, sourceId: answerId, targetId: dataId },
              });
            }

            // Add suggested follow-up query nodes
            mockData.suggestedQueries.slice(0, 2).forEach((q, i) => {
              const subQId = `q-sub-${queryId}-${i}-${Date.now()}`;
              const subQNode: WorkspaceNode = {
                id: subQId,
                type: 'query',
                question: q,
                parentId: answerId,
                position: {
                  x: answerPos.x + i * 320,
                  y: answerPos.y + 340,
                },
                status: 'suggested',
                width: 280,
                height: 100,
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
        }, 30);
      }, 600);
    },
    [] // nodesRef is a stable ref — no dep needed
  );

  const addCustomQuery = useCallback(
    (question: string, parentId: string, parentPos: Position) => {
      const customQId = `q-custom-${Date.now()}`;
      const customNode: WorkspaceNode = {
        id: customQId,
        type: 'query',
        question,
        parentId,
        position: { x: parentPos.x, y: parentPos.y + 160 },
        status: 'suggested',
        width: 280,
        height: 100,
        isCustom: true,
      } as any;
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
      value={{ state, dispatch, initWorkspace, runQuery, addCustomQuery, toggleDashboardPin, deleteNode }}
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
