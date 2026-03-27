'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  AnswerNodeData,
  DataNodeData,
  QueryNodeData,
  WorkspaceNode,
  WorkspaceState,
} from '@/lib/types';
import { FOCUS_QUERY_NODE_EVENT, useWorkspace } from '@/lib/workspace-store';

export function normalizeIntroQuestion(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

export function findQueryIdByParentAndQuestion(
  nodes: WorkspaceNode[],
  parentId: string,
  question: string
): string | null {
  const key = normalizeIntroQuestion(question);
  for (const n of nodes) {
    if (n.type !== 'query') continue;
    if (n.parentId !== parentId) continue;
    if (normalizeIntroQuestion(n.question) === key) return n.id;
  }
  return null;
}

/** Child queries under a parent (root or answer), same order as `syncIntroAnswerSuggestedQueriesWithChildQueries`. */
export function listChildQueriesOrdered(
  nodes: WorkspaceNode[],
  parentId: string
): QueryNodeData[] {
  return nodes
    .filter((n): n is QueryNodeData => n.type === 'query' && n.parentId === parentId)
    .sort(
      (a, b) =>
        a.position.y - b.position.y ||
        a.position.x - b.position.x ||
        a.id.localeCompare(b.id)
    );
}

export type ParentQueryMap = Map<string, string | null>;

/** Same parent-query links as the card shell (query → parent query or root). */
export function buildParentQueryMap(nodes: WorkspaceNode[]): ParentQueryMap {
  const queryNodes = nodes.filter((n): n is QueryNodeData => n.type === 'query');
  const queryById = new Map(queryNodes.map((q) => [q.id, q]));
  const answerOwnerById = new Map<string, string>();
  for (const n of nodes) {
    if (n.type === 'answer') answerOwnerById.set(n.id, n.queryId);
  }

  const parentQueryByQuery = new Map<string, string | null>();
  for (const q of queryNodes) {
    const parentId = q.parentId?.trim();
    if (!parentId) {
      parentQueryByQuery.set(q.id, null);
      continue;
    }
    if (queryById.has(parentId)) {
      parentQueryByQuery.set(q.id, parentId);
      continue;
    }
    const viaAnswer = answerOwnerById.get(parentId) ?? null;
    parentQueryByQuery.set(q.id, viaAnswer && queryById.has(viaAnswer) ? viaAnswer : null);
  }
  return parentQueryByQuery;
}

function emitFocusQueryNode(queryId: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(FOCUS_QUERY_NODE_EVENT, { detail: { queryId } }));
}

type IntroduceRevealContextValue = {
  revealedQueryIds: ReadonlySet<string>;
  revealQuery: (id: string) => void;
  /** First reveal runs a fake “Running → load” sequence; repeat clicks only scroll into view. */
  revealAndRunQuery: (id: string) => void;
  isQueryCardVisible: (queryId: string, parentQueryById: ParentQueryMap) => boolean;
  /** Hide canvas/minimap nodes until the matching query branch is revealed (cards parity). */
  isCanvasNodeVisible: (node: WorkspaceNode, allNodes: WorkspaceNode[]) => boolean;
  /** After a Q&A finishes loading, highlights this answer’s first follow-up (click cue). */
  spotlightAnswerId: string | null;
};

const IntroduceRevealContext = createContext<IntroduceRevealContextValue | null>(null);

export function IntroduceRevealProvider({
  children,
  baselineSnapshot,
}: {
  children: ReactNode;
  baselineSnapshot: WorkspaceState;
}) {
  const baselineRef = useRef(baselineSnapshot);
  baselineRef.current = baselineSnapshot;
  const { dispatch } = useWorkspace();
  const loadTimerRef = useRef<number | null>(null);
  const [ids, setIds] = useState<string[]>([]);
  const [spotlightAnswerId, setSpotlightAnswerId] = useState<string | null>(null);
  const revealedQueryIds = useMemo(() => new Set(ids), [ids]);

  useEffect(() => {
    return () => {
      if (loadTimerRef.current != null) {
        window.clearTimeout(loadTimerRef.current);
        loadTimerRef.current = null;
      }
    };
  }, []);

  const beginQueryRun = useCallback(
    (queryId: string) => {
      const base = baselineRef.current;
      const Q = base.nodes.find((n) => n.id === queryId && n.type === 'query') as
        | QueryNodeData
        | undefined;
      if (!Q) return;

      const A = base.nodes.find(
        (n): n is AnswerNodeData => n.type === 'answer' && n.queryId === queryId
      );
      const D = A
        ? base.nodes.find((n): n is DataNodeData => n.type === 'data' && n.parentId === A.id)
        : undefined;

      if (loadTimerRef.current != null) {
        window.clearTimeout(loadTimerRef.current);
        loadTimerRef.current = null;
      }

      setSpotlightAnswerId(null);

      dispatch({ type: 'UPDATE_NODE', id: queryId, updates: { status: 'running' } });

      if (A) {
        dispatch({
          type: 'UPDATE_NODE',
          id: A.id,
          updates: {
            status: 'streaming',
            content: '',
            streamedChars: 0,
            suggestedQueries: [],
          },
        });
      }

      if (D) {
        dispatch({
          type: 'UPDATE_NODE',
          id: D.id,
          updates: {
            status: 'idle',
            title: '…',
            tableRows: [],
            tableColumns: [],
            listItems: [],
          },
        });
      }

      const contentLen = A?.content?.length ?? 0;
      const loadMs = 900 + Math.min(2200, Math.floor(contentLen / 40));

      loadTimerRef.current = window.setTimeout(() => {
        loadTimerRef.current = null;
        dispatch({
          type: 'UPDATE_NODE',
          id: queryId,
          updates: {
            status: Q.status,
            question: Q.question,
            modelChoice: Q.modelChoice,
            toolChoice: Q.toolChoice,
          },
        });
        if (A) {
          dispatch({
            type: 'UPDATE_NODE',
            id: A.id,
            updates: {
              status: 'complete',
              content: A.content,
              streamedChars: undefined,
              extractedKeywords: A.extractedKeywords,
              suggestedQueries: A.suggestedQueries,
            },
          });
        }
        if (D) {
          dispatch({
            type: 'UPDATE_NODE',
            id: D.id,
            updates: {
              status: D.status,
              dataType: D.dataType,
              title: D.title,
              subtitle: D.subtitle,
              tableColumns: D.tableColumns,
              tableRows: D.tableRows,
              listItems: D.listItems,
              chartData: D.chartData,
              metrics: D.metrics,
            },
          });
        }
        if (A && A.suggestedQueries.length > 0) {
          setSpotlightAnswerId(A.id);
        } else {
          setSpotlightAnswerId(null);
        }
      }, loadMs);
    },
    [dispatch]
  );

  const revealQuery = useCallback((id: string) => {
    setIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const revealAndRunQuery = useCallback(
    (queryId: string) => {
      const already = revealedQueryIds.has(queryId);
      revealQuery(queryId);
      if (!already) {
        beginQueryRun(queryId);
      } else {
        emitFocusQueryNode(queryId);
      }
    },
    [revealedQueryIds, revealQuery, beginQueryRun]
  );

  const isQueryCardVisible = useCallback(
    (queryId: string, parentQueryById: ParentQueryMap) => {
      if (!revealedQueryIds.has(queryId)) return false;
      let pid: string | null | undefined = parentQueryById.get(queryId);
      while (pid) {
        if (!revealedQueryIds.has(pid)) return false;
        pid = parentQueryById.get(pid) ?? null;
      }
      return true;
    },
    [revealedQueryIds]
  );

  const isCanvasNodeVisible = useCallback(
    (node: WorkspaceNode, allNodes: WorkspaceNode[]) => {
      const parentMap = buildParentQueryMap(allNodes);
      if (node.type === 'root') return true;
      if (node.type === 'query') {
        return isQueryCardVisible(node.id, parentMap);
      }
      if (node.type === 'answer') {
        return isQueryCardVisible(node.queryId, parentMap);
      }
      if (node.type === 'data') {
        const parent = allNodes.find((n) => n.id === node.parentId);
        if (parent?.type === 'answer') {
          if (!isQueryCardVisible(parent.queryId, parentMap)) return false;
          return parent.status === 'complete';
        }
        return true;
      }
      return true;
    },
    [isQueryCardVisible]
  );

  const value = useMemo(
    () => ({
      revealedQueryIds,
      revealQuery,
      revealAndRunQuery,
      isQueryCardVisible,
      isCanvasNodeVisible,
      spotlightAnswerId,
    }),
    [
      revealedQueryIds,
      revealQuery,
      revealAndRunQuery,
      isQueryCardVisible,
      isCanvasNodeVisible,
      spotlightAnswerId,
    ]
  );

  return (
    <IntroduceRevealContext.Provider value={value}>{children}</IntroduceRevealContext.Provider>
  );
}

export function useIntroduceReveal(): IntroduceRevealContextValue | null {
  return useContext(IntroduceRevealContext);
}
