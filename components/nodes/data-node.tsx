'use client';

import type { DataNodeData } from '@/lib/types';
import { useWorkspace } from '@/lib/workspace-store';
import { useI18n } from '@/components/i18n-provider';
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

export function DataNode({ node }: Props) {
  const { t } = useI18n();
  const { toggleDashboardPin, state } = useWorkspace();
  const isPinned = state.dashboardNodeIds.includes(node.id);

  return (
    <div
      className="flex flex-col gap-3 rounded-2xl border p-4 transition-all duration-300"
      style={{
        borderColor: isPinned ? 'rgba(0,196,154,0.5)' : 'rgba(245,158,11,0.25)',
        background: 'rgba(245,158,11,0.03)',
        boxShadow: isPinned
          ? '0 0 20px rgba(0,196,154,0.12)'
          : '0 4px 16px rgba(0,0,0,0.35)',
        backdropFilter: 'blur(8px)',
        minWidth: 300,
        maxWidth: 340,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold"
            style={{ background: '#F59E0B', color: '#080C12' }}
          >
            <DataIcon type={node.dataType} />
          </span>
          <span className="text-xs font-medium" style={{ color: '#F59E0B' }}>
            {node.title}
          </span>
        </div>
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

      {/* Data rendering */}
      <div className="min-h-[160px]">
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
    <div className="overflow-x-auto rounded-xl" style={{ background: 'rgba(0,0,0,0.25)' }}>
      <table className="w-full text-xs">
        <thead>
          <tr>
            {node.tableColumns.map((col) => (
              <th
                key={col}
                className="border-b px-3 py-2 text-left font-semibold text-muted-foreground"
                style={{ borderColor: 'rgba(245,158,11,0.15)' }}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {node.tableRows.map((row, i) => (
            <tr key={i} className="transition-colors hover:bg-white/[0.02]">
              {node.tableColumns!.map((col) => (
                <td
                  key={col}
                  className="border-b px-3 py-2 text-foreground/80"
                  style={{ borderColor: 'rgba(245,158,11,0.08)' }}
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
    <ul className="flex flex-col gap-1.5">
      {node.listItems.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-xs text-foreground/80">
          <span
            className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
            style={{ background: 'rgba(245,158,11,0.2)', color: '#F59E0B' }}
          >
            {i + 1}
          </span>
          {item}
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
          className="flex flex-col gap-1 rounded-xl p-3"
          style={{ background: 'rgba(0,0,0,0.25)' }}
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
