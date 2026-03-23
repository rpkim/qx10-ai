import { z } from 'zod';
import type { DataNodeType } from '@/lib/types';

const chartPointSchema = z.object({
  label: z.string(),
  value: z.number(),
  value2: z.number().optional(),
});

const metricSchema = z.object({
  label: z.string(),
  value: z.string(),
  change: z.string().optional(),
  up: z.boolean().optional(),
});

/** LLM JSON for optional visual node (matches workspace DataNode fields). */
export const dataNodePayloadSchema = z.object({
  dataType: z.enum(['table', 'bar-chart', 'line-chart', 'list', 'metric']),
  title: z.string(),
  subtitle: z.string().optional(),
  tableColumns: z.array(z.string()).optional(),
  tableRows: z.array(z.record(z.union([z.string(), z.number()]))).optional(),
  chartData: z.array(chartPointSchema).optional(),
  metrics: z.array(metricSchema).optional(),
  listItems: z.array(z.string()).optional(),
});

export const queryMetadataSchema = z.object({
  extractedKeywords: z.array(z.string()).min(1).max(14),
  suggestedQueries: z.array(z.string()).min(2).max(8),
  /** Omit or null when no chart/table adds value. */
  dataNode: dataNodePayloadSchema.nullable().optional(),
});

export type QueryMetadataPayload = z.infer<typeof queryMetadataSchema>;

export function parseQueryMetadata(raw: unknown): QueryMetadataPayload | null {
  const r = queryMetadataSchema.safeParse(raw);
  return r.success ? r.data : null;
}

export function normalizeDataNodePayload(
  dn: NonNullable<QueryMetadataPayload['dataNode']>
): {
  dataType: DataNodeType;
  title: string;
  subtitle?: string;
  tableColumns?: string[];
  tableRows?: Record<string, string | number>[];
  chartData?: { label: string; value: number; value2?: number }[];
  metrics?: { label: string; value: string; change?: string; up?: boolean }[];
  listItems?: string[];
} {
  return {
    dataType: dn.dataType,
    title: dn.title,
    subtitle: dn.subtitle,
    tableColumns: dn.tableColumns,
    tableRows: dn.tableRows as Record<string, string | number>[] | undefined,
    chartData: dn.chartData,
    metrics: dn.metrics,
    listItems: dn.listItems,
  };
}
