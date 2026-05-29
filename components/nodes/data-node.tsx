'use client';

import { useState } from 'react';
import type { DataNodeData } from '@/lib/types';
import {
  fetchMarketQuotePayload,
  marketDataNodeRefreshSymbol,
} from '@/lib/market-data-node-refresh';
import { useWorkspace } from '@/lib/workspace-store';
import { useI18n } from '@/components/i18n-provider';
import { RefreshCw } from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface Props {
  node: DataNodeData;
}

/** Cream card shell + white inner panel (aligned with dashboard Data widgets). */
const DATA_NODE_CARD_CLASS =
  'border-amber-200/80 bg-gradient-to-br from-amber-50/95 via-amber-50/70 to-amber-100/45 shadow-md shadow-amber-200/20 dark:border-amber-500/30 dark:from-amber-500/[0.12] dark:via-amber-500/[0.07] dark:to-amber-600/[0.04]';
const DATA_NODE_INNER_CLASS =
  'rounded-xl bg-white p-3 shadow-sm ring-1 ring-black/[0.04] dark:bg-zinc-950 dark:ring-amber-500/15';

export function DataNode({ node }: Props) {
  const { t } = useI18n();
  const { toggleDashboardPin, state, dispatch } = useWorkspace();
  const isPinned = state.dashboardNodeIds.includes(node.id);
  const [refreshing, setRefreshing] = useState(false);
  const stockSymbol = marketDataNodeRefreshSymbol(node);
  const isStockNode = !!stockSymbol;

  const refreshStock = async () => {
    if (!stockSymbol || refreshing) return;
    setRefreshing(true);
    try {
      const payload = await fetchMarketQuotePayload(stockSymbol);
      if (!payload) return;
      dispatch({
        type: 'UPDATE_NODE',
        id: node.id,
        updates: {
          dataType: payload.dataType,
          title: payload.title,
          subtitle: payload.subtitle,
          metrics: payload.metrics,
          chartData: payload.chartData,
          tableColumns: payload.tableColumns,
          tableRows: payload.tableRows,
          listItems: payload.listItems,
        } as Partial<DataNodeData>,
      });
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div
      className={[
        'flex min-w-0 max-w-full flex-col gap-3 overflow-hidden rounded-2xl border p-4 transition-all duration-300',
        DATA_NODE_CARD_CLASS,
        isPinned ? 'border-primary/50 shadow-[0_0_20px_rgba(0,196,154,0.12)]' : '',
      ].join(' ')}
      style={{ minWidth: 260, maxWidth: 340 }}
    >
      {/* Header */}
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold"
            style={{ background: '#F59E0B', color: '#080C12' }}
          >
            <DataIcon type={node.dataType} />
          </span>
          <span className="min-w-0 truncate text-xs font-medium" style={{ color: '#F59E0B' }}>
            {node.title}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {isStockNode && (
            <button
              onClick={refreshStock}
              disabled={refreshing}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
              title="Refresh quote"
            >
              <RefreshCw className={`size-3 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          )}
          <button
            onClick={() => toggleDashboardPin(node.id)}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs transition-colors"
            style={
              isPinned
                ? { background: 'rgba(0,196,154,0.15)', color: '#00C49A' }
                : { color: 'var(--muted-foreground)' }
            }
            title={isPinned ? 'Remove from dashboard' : 'Pin to dashboard'}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill={isPinned ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            {isPinned ? t('nodes.pinnedAction') : t('nodes.pinAction')}
          </button>
        </div>
      </div>

      {/* Data rendering */}
      <div className={`min-h-[160px] min-w-0 overflow-x-hidden ${DATA_NODE_INNER_CLASS}`}>
        {node.dataType === 'table' && <TableView node={node} />}
        {node.dataType === 'bar-chart' && <BarChartView node={node} />}
        {node.dataType === 'line-chart' && <LineChartView node={node} />}
        {node.dataType === 'list' && <ListView node={node} />}
        {node.dataType === 'metric' && <MetricView node={node} />}
      </div>
    </div>
  );
}

function DataIcon({ type }: { type: string }) {
  switch (type) {
    case 'bar-chart':
      return (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
          <rect x="2" y="12" width="5" height="10" /><rect x="10" y="6" width="5" height="16" /><rect x="18" y="2" width="5" height="20" />
        </svg>
      );
    case 'line-chart':
      return (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <polyline points="3,17 8,12 13,15 21,6" />
        </svg>
      );
    case 'list':
      return (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><circle cx="3" cy="6" r="1.5" fill="currentColor" /><circle cx="3" cy="12" r="1.5" fill="currentColor" /><circle cx="3" cy="18" r="1.5" fill="currentColor" />
        </svg>
      );
    case 'metric':
      return (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
      );
    default:
      return <span>T</span>;
  }
}

function TableView({ node }: { node: DataNodeData }) {
  if (!node.tableColumns || !node.tableRows) return null;
  return (
    <div className="max-h-[min(50vh,420px)] min-w-0 overflow-x-auto overflow-y-auto overscroll-y-contain rounded-lg [scrollbar-width:thin]">
      <table className="w-full min-w-0 table-fixed text-xs">
        <thead>
          <tr>
            {node.tableColumns.map((col) => (
              <th
                key={col}
                className="min-w-0 max-w-0 border-b border-border/70 px-2 py-2 text-left align-top font-semibold break-words text-muted-foreground [overflow-wrap:anywhere] sm:px-3"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {node.tableRows.map((row, i) => (
            <tr key={i} className="transition-colors hover:bg-muted/40">
              {node.tableColumns!.map((col) => (
                <td
                  key={col}
                  className="min-w-0 max-w-0 border-b border-border/40 px-2 py-2 align-top break-words text-foreground/85 [overflow-wrap:anywhere] sm:px-3"
                >
                  {String(row[col] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BarChartView({ node }: { node: DataNodeData }) {
  if (!node.chartData) return null;
  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={node.chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <XAxis
          dataKey="label"
          tick={{ fill: 'rgba(148,163,184,0.7)', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis tick={{ fill: 'rgba(148,163,184,0.7)', fontSize: 10 }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: '#0F1623', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, fontSize: 11 }}
          labelStyle={{ color: '#E2E8F0' }}
          itemStyle={{ color: '#F59E0B' }}
        />
        <Bar dataKey="value" fill="#F59E0B" fillOpacity={0.85} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function LineChartView({ node }: { node: DataNodeData }) {
  if (!node.chartData) return null;
  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={node.chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <XAxis
          dataKey="label"
          tick={{ fill: 'rgba(148,163,184,0.7)', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis tick={{ fill: 'rgba(148,163,184,0.7)', fontSize: 10 }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: '#0F1623', border: '1px solid rgba(0,196,154,0.3)', borderRadius: 8, fontSize: 11 }}
          labelStyle={{ color: '#E2E8F0' }}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="#00C49A"
          strokeWidth={2}
          dot={false}
          name="Strategy"
        />
        {node.chartData[0]?.value2 !== undefined && (
          <Line
            type="monotone"
            dataKey="value2"
            stroke="#F59E0B"
            strokeWidth={1.5}
            strokeDasharray="4 2"
            dot={false}
            name="Benchmark"
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}

function ListView({ node }: { node: DataNodeData }) {
  if (!node.listItems) return null;
  return (
    <ul className="flex min-w-0 flex-col gap-1.5">
      {node.listItems.map((item, i) => (
        <li key={i} className="flex min-w-0 items-start gap-2 text-xs text-foreground/80">
          <span
            className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
            style={{ background: 'rgba(245,158,11,0.2)', color: '#F59E0B' }}
          >
            {i + 1}
          </span>
          <span className="min-w-0 flex-1 [overflow-wrap:anywhere] break-words">
            {item}
          </span>
        </li>
      ))}
    </ul>
  );
}

function MetricView({ node }: { node: DataNodeData }) {
  if (!node.metrics) return null;
  return (
    <div className="grid grid-cols-2 gap-2">
      {node.metrics.map((m) => (
        <div
          key={m.label}
          className="flex flex-col gap-1 rounded-lg border border-border/50 bg-muted/25 p-3"
        >
          <span className="text-xs text-muted-foreground">{m.label}</span>
          <span
            className="text-lg font-bold"
            style={{ fontFamily: 'var(--font-space-grotesk)', color: m.up ? '#00C49A' : '#F59E0B' }}
          >
            {m.value}
          </span>
          {m.change && <span className="text-xs text-muted-foreground">{m.change}</span>}
        </div>
      ))}
    </div>
  );
}
