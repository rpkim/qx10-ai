import type {
  AnswerNodeData,
  DataNodeData,
  QueryNodeData,
  WorkspaceState,
} from '@/lib/types';
import type { DemoResponse } from '@/lib/workspace-store';

function dataNodeToPayload(d: DataNodeData): Record<string, unknown> {
  return {
    dataType: d.dataType,
    title: d.title,
    subtitle: d.subtitle,
    tableColumns: d.tableColumns,
    tableRows: d.tableRows,
    listItems: d.listItems,
    chartData: d.chartData,
    metrics: d.metrics,
  };
}

/**
 * Maps every query question in a saved workspace to its answer + data so `runQuery` uses
 * demo flow only (no live LLM) when passed as `WorkspaceProvider` `demoResponses`.
 */
export function buildDemoResponsesFromSnapshot(state: WorkspaceState): Record<string, DemoResponse> {
  const out: Record<string, DemoResponse> = {};
  for (const n of state.nodes) {
    if (n.type !== 'query') continue;
    const q = n as QueryNodeData;
    const ans = state.nodes.find(
      (x): x is AnswerNodeData => x.type === 'answer' && x.queryId === q.id
    );
    if (!ans) continue;
    const data = state.nodes.find(
      (x): x is DataNodeData => x.type === 'data' && x.parentId === ans.id
    );
    const payload = {
      content: ans.content,
      extractedKeywords: ans.extractedKeywords,
      suggestedQueries: ans.suggestedQueries,
      dataNode: data ? dataNodeToPayload(data) : null,
    };
    out[q.question] = payload;
    out[q.id] = payload;
  }
  return out;
}
