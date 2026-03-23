'use client';

import { useState, useCallback } from 'react';
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
  const { nodes, dashboardNodeIds, keyword, goal } = state;
  const [widgetOrder, setWidgetOrder] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  const pinnedNodes = nodes.filter((n) => dashboardNodeIds.includes(n.id));

  // Maintain insertion order + custom reorder
  const orderedIds = [
    ...widgetOrder.filter((id) => dashboardNodeIds.includes(id)),
    ...dashboardNodeIds.filter((id) => !widgetOrder.includes(id)),
  ];
  const orderedNodes = orderedIds
    .map((id) => pinnedNodes.find((n) => n.id === id))
    .filter(Boolean) as WorkspaceNode[];

  // Drag-to-reorder
  const handleDragStart = (id: string) => setDragging(id);
  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    setDragOver(id);
  };
  const handleDrop = (targetId: string) => {
    if (!dragging || dragging === targetId) return;
    const base = orderedIds.filter((id) => id !== dragging);
    const idx = base.indexOf(targetId);
    base.splice(idx, 0, dragging);
    setWidgetOrder(base);
    setDragging(null);
    setDragOver(null);
  };
  const handleDragEnd = () => {
    setDragging(null);
    setDragOver(null);
  };

  const handleExport = () => {
    const data = orderedNodes.map((n) => ({
      type: n.type,
      title: n.type === 'answer' ? 'Answer' : (n as DataNodeData).title,
      content: n.type === 'answer' ? (n as AnswerNodeData).content : undefined,
      keywords: n.type === 'answer' ? (n as AnswerNodeData).extractedKeywords : undefined,
    }));
    const blob = new Blob([JSON.stringify({ keyword, goal, widgets: data }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `socrates-dashboard-${keyword.replace(/\s+/g, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="absolute inset-y-0 right-0 z-30 flex w-[480px] flex-col"
      style={{ borderLeft: '1px solid var(--border)', background: 'var(--card)' }}
    >
      {/* Header */}
      <div
        className="flex shrink-0 items-center justify-between px-5 py-4"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00C49A" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            <h2
              className="text-base font-bold text-foreground"
              style={{ fontFamily: 'var(--font-space-grotesk)' }}
            >
              Dashboard
            </h2>
            {pinnedNodes.length > 0 && (
              <span
                className="flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs font-bold"
                style={{ background: 'rgba(0,196,154,0.15)', color: '#00C49A' }}
              >
                {pinnedNodes.length}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {keyword}
            <span
              className="ml-1.5 rounded-full px-1.5 py-0.5 capitalize"
              style={{ background: 'rgba(0,196,154,0.1)', color: '#00C49A' }}
            >
              {goal}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          {pinnedNodes.length > 0 && (
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              title="Export dashboard as JSON"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="Close dashboard"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {orderedNodes.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="flex flex-col gap-3 p-4">
            {pinnedNodes.length > 1 && (
              <p className="text-xs text-muted-foreground/60">Drag widgets to reorder</p>
            )}
            {orderedNodes.map((node) => (
              <div
                key={node.id}
                draggable
                onDragStart={() => handleDragStart(node.id)}
                onDragOver={(e) => handleDragOver(e, node.id)}
                onDrop={() => handleDrop(node.id)}
                onDragEnd={handleDragEnd}
                style={{
                  opacity: dragging === node.id ? 0.4 : 1,
                  outline: dragOver === node.id && dragging !== node.id
                    ? '2px solid rgba(0,196,154,0.6)'
                    : 'none',
                  borderRadius: '16px',
                  transition: 'opacity 0.15s, outline 0.1s',
                }}
              >
                <DashboardWidget
                  node={node}
                  onUnpin={() => toggleDashboardPin(node.id)}
                />
              </div>
            ))}

            {/* Summary footer */}
            <div
              className="mt-1 rounded-2xl border p-4"
              style={{ borderColor: 'rgba(0,196,154,0.12)', background: 'rgba(0,196,154,0.03)' }}
            >
              <p className="text-xs font-semibold text-muted-foreground mb-2">Summary</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Widgets', value: pinnedNodes.length },
                  { label: 'Answers', value: pinnedNodes.filter((n) => n.type === 'answer').length },
                  { label: 'Data', value: pinnedNodes.filter((n) => n.type === 'data').length },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="flex flex-col items-center gap-0.5 rounded-xl py-2"
                    style={{ background: 'rgba(0,0,0,0.2)' }}
                  >
                    <span
                      className="text-xl font-bold"
                      style={{ fontFamily: 'var(--font-space-grotesk)', color: '#00C49A' }}
                    >
                      {s.value}
                    </span>
                    <span className="text-xs text-muted-foreground">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-5 px-6 py-16 text-center">
      <div
        className="flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{ background: 'rgba(0,196,154,0.08)', border: '1px solid rgba(0,196,154,0.2)' }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00C49A" strokeWidth="1.5">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      </div>
      <div>
        <p className="font-semibold text-foreground">Your dashboard is empty</p>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Run queries on the canvas, then pin Answer or Data nodes here to build your knowledge dashboard.
        </p>
      </div>
      <div
        className="flex flex-col gap-3 w-full rounded-2xl border border-border bg-secondary px-4 py-4 text-left"
      >
        <p className="text-xs font-semibold text-foreground">How to add widgets:</p>
        {[
          { step: '1', text: 'Click Run on any Query node' },
          { step: '2', text: 'Wait for the Answer to generate' },
          { step: '3', text: 'Click Pin on an Answer or Data node' },
        ].map((s) => (
          <div key={s.step} className="flex items-center gap-3">
            <span
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold"
              style={{ background: 'rgba(0,196,154,0.15)', color: '#00C49A' }}
            >
              {s.step}
            </span>
            <span className="text-xs text-muted-foreground">{s.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardWidget({ node, onUnpin }: { node: WorkspaceNode; onUnpin: () => void }) {
  const [collapsed, setCollapsed] = useState(false);

  const title = node.type === 'answer' ? 'Answer' : (node as DataNodeData).title;
  const badge =
    node.type === 'answer'
      ? { bg: 'rgba(163,230,53,0.15)', color: '#A3E635', label: 'A' }
      : { bg: 'rgba(245,158,11,0.15)', color: '#F59E0B', label: 'D' };

  return (
    <div
      className="flex flex-col gap-0 rounded-2xl border overflow-hidden"
      style={{ borderColor: 'var(--border)', background: 'rgba(255,255,255,0.015)' }}
    >
      {/* Widget header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: collapsed ? 'none' : '1px solid var(--border)', cursor: 'grab' }}
      >
        <div className="flex items-center gap-2">
          {/* drag handle */}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/40 shrink-0">
            <circle cx="9" cy="5" r="1" fill="currentColor" /><circle cx="15" cy="5" r="1" fill="currentColor" />
            <circle cx="9" cy="12" r="1" fill="currentColor" /><circle cx="15" cy="12" r="1" fill="currentColor" />
            <circle cx="9" cy="19" r="1" fill="currentColor" /><circle cx="15" cy="19" r="1" fill="currentColor" />
          </svg>
          <span
            className="flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold"
            style={{ background: badge.bg, color: badge.color }}
          >
            {badge.label}
          </span>
          <span className="text-sm font-medium text-foreground truncate max-w-[200px]">{title}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="rounded-lg p-1.5 text-muted-foreground/60 transition-colors hover:text-foreground"
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          <button
            onClick={onUnpin}
            className="rounded-lg p-1.5 text-muted-foreground/60 transition-colors hover:text-destructive"
            title="Remove from dashboard"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Widget content */}
      {!collapsed && (
        <div className="px-4 py-3">
          {node.type === 'answer' && <AnswerWidget node={node as AnswerNodeData} />}
          {node.type === 'data' && <DataWidget node={node as DataNodeData} />}
        </div>
      )}
    </div>
  );
}

function AnswerWidget({ node }: { node: AnswerNodeData }) {
  const [expanded, setExpanded] = useState(false);
  const preview = node.content.slice(0, 280);
  const isTruncated = node.content.length > 280;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs leading-relaxed text-foreground/80">
        {expanded ? node.content : preview}
        {isTruncated && !expanded && '...'}
      </p>
      {isTruncated && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="self-start text-xs text-primary/70 hover:text-primary transition-colors"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
      {node.extractedKeywords.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {node.extractedKeywords.map((kw) => (
            <span
              key={kw}
              className="rounded-full border px-2 py-0.5 text-xs"
              style={{ borderColor: 'rgba(163,230,53,0.2)', color: '#A3E635' }}
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
      {node.subtitle && (
        <p className="mb-2 text-xs text-muted-foreground">{node.subtitle}</p>
      )}
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
                <tr key={i} className="transition-colors hover:bg-white/[0.02]">
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
