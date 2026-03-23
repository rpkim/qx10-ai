'use client';

import type { DataNodeData, AnswerNodeData, WorkspaceNode } from '@/lib/types';
import { useWorkspace } from '@/lib/workspace-store';
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
  onClose: () => void;
}

export function DashboardPanel({ onClose }: Props) {
  const { state, toggleDashboardPin } = useWorkspace();
  const { nodes, dashboardNodeIds, keyword } = state;

  const pinnedNodes = nodes.filter((n) => dashboardNodeIds.includes(n.id));

  return (
    <div
      className="absolute inset-y-0 right-0 z-30 flex w-[480px] flex-col border-l bg-card"
      style={{ borderColor: 'var(--border)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between border-b px-6 py-4"
        style={{ borderColor: 'var(--border)' }}
      >
        <div>
          <h2
            className="text-lg font-bold text-foreground"
            style={{ fontFamily: 'var(--font-space-grotesk)' }}
          >
            Dashboard
          </h2>
          <p className="text-xs text-muted-foreground">
            {keyword} — {pinnedNodes.length} component{pinnedNodes.length !== 1 ? 's' : ''} pinned
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4">
        {pinnedNodes.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="flex flex-col gap-4">
            {pinnedNodes.map((node) => (
              <DashboardWidget
                key={node.id}
                node={node}
                onUnpin={() => toggleDashboardPin(node.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <div
        className="flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{ background: 'rgba(0,196,154,0.08)', border: '1px solid rgba(0,196,154,0.2)' }}
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#00C49A"
          strokeWidth="1.5"
        >
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      </div>
      <div>
        <p className="font-semibold text-foreground">No components yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Pin answer or data nodes from the canvas to build your dashboard.
        </p>
      </div>
      <div className="rounded-xl border border-border bg-secondary px-4 py-3 text-xs text-muted-foreground">
        Click the <strong className="text-foreground">Pin</strong> button on any Answer or Data node
      </div>
    </div>
  );
}

function DashboardWidget({
  node,
  onUnpin,
}: {
  node: WorkspaceNode;
  onUnpin: () => void;
}) {
  return (
    <div
      className="flex flex-col gap-3 rounded-2xl border p-4"
      style={{ borderColor: 'var(--border)', background: 'rgba(255,255,255,0.02)' }}
    >
      {/* Widget header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <NodeTypeBadge type={node.type} />
          <span className="text-sm font-medium text-foreground">
            {getNodeTitle(node)}
          </span>
        </div>
        <button
          onClick={onUnpin}
          className="rounded-lg p-1 text-muted-foreground transition-colors hover:text-destructive"
          title="Remove from dashboard"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Widget content */}
      {node.type === 'answer' && <AnswerWidget node={node as AnswerNodeData} />}
      {node.type === 'data' && <DataWidget node={node as DataNodeData} />}
    </div>
  );
}

function NodeTypeBadge({ type }: { type: string }) {
  const styles =
    type === 'answer'
      ? { bg: 'rgba(163,230,53,0.15)', color: '#A3E635', label: 'A' }
      : { bg: 'rgba(245,158,11,0.15)', color: '#F59E0B', label: 'D' };
  return (
    <span
      className="flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold"
      style={{ background: styles.bg, color: styles.color }}
    >
      {styles.label}
    </span>
  );
}

function getNodeTitle(node: WorkspaceNode): string {
  if (node.type === 'answer') return 'Answer';
  if (node.type === 'data') return (node as DataNodeData).title;
  return node.type;
}

function AnswerWidget({ node }: { node: AnswerNodeData }) {
  const preview = node.content.slice(0, 220) + (node.content.length > 220 ? '...' : '');
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs leading-relaxed text-foreground/80">{preview}</p>
      {node.extractedKeywords.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {node.extractedKeywords.map((kw) => (
            <span
              key={kw}
              className="rounded-full border px-2 py-0.5 text-xs"
              style={{ borderColor: 'rgba(163,230,53,0.25)', color: '#A3E635' }}
            >
              {kw}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function DataWidget({ node }: { node: DataNodeData }) {
  return (
    <div>
      {node.dataType === 'bar-chart' && node.chartData && (
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={node.chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <XAxis dataKey="label" tick={{ fill: 'rgba(148,163,184,0.7)', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'rgba(148,163,184,0.7)', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: '#0F1623', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, fontSize: 11 }} labelStyle={{ color: '#E2E8F0' }} itemStyle={{ color: '#F59E0B' }} />
            <Bar dataKey="value" fill="#F59E0B" fillOpacity={0.85} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
      {node.dataType === 'line-chart' && node.chartData && (
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={node.chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <XAxis dataKey="label" tick={{ fill: 'rgba(148,163,184,0.7)', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'rgba(148,163,184,0.7)', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: '#0F1623', border: '1px solid rgba(0,196,154,0.3)', borderRadius: 8, fontSize: 11 }} labelStyle={{ color: '#E2E8F0' }} />
            <Line type="monotone" dataKey="value" stroke="#00C49A" strokeWidth={2} dot={false} name="Strategy" />
            {node.chartData[0]?.value2 !== undefined && (
              <Line type="monotone" dataKey="value2" stroke="#F59E0B" strokeWidth={1.5} strokeDasharray="4 2" dot={false} name="Benchmark" />
            )}
          </LineChart>
        </ResponsiveContainer>
      )}
      {node.dataType === 'table' && node.tableRows && (
        <div className="overflow-x-auto rounded-xl" style={{ background: 'rgba(0,0,0,0.2)' }}>
          <table className="w-full text-xs">
            <thead>
              <tr>
                {node.tableColumns?.map((col) => (
                  <th key={col} className="border-b px-3 py-2 text-left font-semibold text-muted-foreground" style={{ borderColor: 'rgba(245,158,11,0.12)' }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {node.tableRows.map((row, i) => (
                <tr key={i}>
                  {node.tableColumns?.map((col) => (
                    <td key={col} className="border-b px-3 py-2 text-foreground/80" style={{ borderColor: 'rgba(245,158,11,0.06)' }}>{String(row[col] ?? '')}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {node.dataType === 'list' && node.listItems && (
        <ul className="flex flex-col gap-1.5">
          {node.listItems.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-foreground/80">
              <span className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold" style={{ background: 'rgba(245,158,11,0.2)', color: '#F59E0B' }}>{i + 1}</span>
              {item}
            </li>
          ))}
        </ul>
      )}
      {node.dataType === 'metric' && node.metrics && (
        <div className="grid grid-cols-2 gap-2">
          {node.metrics.map((m) => (
            <div key={m.label} className="flex flex-col gap-1 rounded-xl p-3" style={{ background: 'rgba(0,0,0,0.2)' }}>
              <span className="text-xs text-muted-foreground">{m.label}</span>
              <span className="text-xl font-bold" style={{ fontFamily: 'var(--font-space-grotesk)', color: m.up ? '#00C49A' : '#F59E0B' }}>{m.value}</span>
              {m.change && <span className="text-xs text-muted-foreground">{m.change}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
