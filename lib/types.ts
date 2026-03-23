export type GoalType = 'learn' | 'build' | 'research' | 'analyze' | 'strategize';

export type AiProviderId = 'openai' | 'gemini';

/** One selectable model in the workspace (matches GET /api/workspace/models). */
export interface AiModelOption {
  id: string;
  provider: AiProviderId;
  model: string;
  label: string;
}

export interface AiModelCatalog {
  defaultChoice: string;
  options: AiModelOption[];
}

export type NodeType = 'root' | 'query' | 'answer' | 'data';

export type NodeStatus =
  | 'idle'
  | 'suggested'
  | 'running'
  | 'streaming'
  | 'complete'
  | 'error';

export type DataNodeType = 'table' | 'bar-chart' | 'line-chart' | 'list' | 'metric';

export interface Position {
  x: number;
  y: number;
}

export interface BaseNode {
  id: string;
  type: NodeType;
  position: Position;
  parentId?: string;
  status: NodeStatus;
  isPinned?: boolean;
  width?: number;
  height?: number;
}

export interface RootNodeData extends BaseNode {
  type: 'root';
  keyword: string;
  goal: GoalType;
}

export interface QueryNodeData extends BaseNode {
  type: 'query';
  question: string;
  isCustom?: boolean;
  /** Catalog id (`provider:model`); omit to use server default (AI_DEFAULT). */
  modelChoice?: string;
}

export interface AnswerNodeData extends BaseNode {
  type: 'answer';
  queryId: string;
  content: string;
  streamedChars?: number;
  extractedKeywords: string[];
  suggestedQueries: string[];
}

export interface TableRow {
  [key: string]: string | number;
}

export interface ChartPoint {
  label: string;
  value: number;
  value2?: number;
}

export interface DataNodeData extends BaseNode {
  type: 'data';
  dataType: DataNodeType;
  title: string;
  subtitle?: string;
  tableColumns?: string[];
  tableRows?: TableRow[];
  chartData?: ChartPoint[];
  metrics?: { label: string; value: string; change?: string; up?: boolean }[];
  listItems?: string[];
}

export type WorkspaceNode =
  | RootNodeData
  | QueryNodeData
  | AnswerNodeData
  | DataNodeData;

export interface Edge {
  id: string;
  sourceId: string;
  targetId: string;
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export interface WorkspaceState {
  keyword: string;
  goal: GoalType;
  nodes: WorkspaceNode[];
  edges: Edge[];
  viewport: Viewport;
  selectedNodeId: string | null;
  dashboardNodeIds: string[];
}
