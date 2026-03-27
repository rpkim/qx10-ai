'use client';

import { useMemo, useState } from 'react';
import type { AnswerNodeData, DataNodeData, QueryNodeData, WorkspaceNode } from '@/lib/types';
import { useWorkspace } from '@/lib/workspace-store';
import { useI18n } from '@/components/i18n-provider';

type MobileTab = 'explore' | 'dashboard';

interface Props {
  showDashboard: boolean;
  onShowDashboardChange: (show: boolean) => void;
  isMobile: boolean;
}

export function MobileWorkspaceShell({ showDashboard, onShowDashboardChange, isMobile }: Props) {
  const { t } = useI18n();
  const { state, runQuery, addCustomQuery, toggleDashboardPin, aiCatalog } = useWorkspace();
  const [customInputByAnswer, setCustomInputByAnswer] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<MobileTab>('explore');

  const queryNodes = useMemo(
    () =>
      state.nodes
        .filter((n): n is QueryNodeData => n.type === 'query')
        .sort((a, b) => {
          const ak = a.id.match(/(\d{10,})/)?.[1];
          const bk = b.id.match(/(\d{10,})/)?.[1];
          return Number(ak ?? 0) - Number(bk ?? 0);
        }),
    [state.nodes]
  );

  const answerByQuery = useMemo(() => {
    const map = new Map<string, AnswerNodeData>();
    for (const n of state.nodes) {
      if (n.type === 'answer') map.set(n.queryId, n);
    }
    return map;
  }, [state.nodes]);

  const dataByAnswer = useMemo(() => {
    const map = new Map<string, DataNodeData>();
    for (const n of state.nodes) {
      if (n.type === 'data' && n.parentId) map.set(n.parentId, n);
    }
    return map;
  }, [state.nodes]);

  const pinned = useMemo(
    () => state.nodes.filter((n) => state.dashboardNodeIds.includes(n.id)),
    [state.nodes, state.dashboardNodeIds]
  );

  const effectiveTab: MobileTab = showDashboard ? 'dashboard' : activeTab;

  const modelLabel = (q: QueryNodeData): string => {
    const id = q.modelChoice ?? aiCatalog?.defaultChoice ?? '';
    return aiCatalog?.options.find((o) => o.id === id)?.label ?? (id || 'Default');
  };

  return (
    <div
      className={[
        'absolute inset-0 overflow-y-auto bg-background',
        isMobile ? 'top-16 pb-24' : 'top-20 pb-6',
      ].join(' ')}
    >
      <div
        className={[
          'mx-auto flex w-full flex-col gap-3 px-3 py-3',
          isMobile ? 'max-w-xl' : 'max-w-5xl',
        ].join(' ')}
      >
        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-border bg-card p-1">
          {(['explore', 'dashboard'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setActiveTab(tab);
                if (tab !== 'dashboard') onShowDashboardChange(false);
                if (tab === 'dashboard') onShowDashboardChange(true);
              }}
              className={[
                'rounded-xl px-2 py-2 text-xs font-medium transition-colors',
                effectiveTab === tab
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:bg-secondary',
              ].join(' ')}
            >
              {tab === 'explore' ? 'Explore' : t('toolbar.dashboard')}
            </button>
          ))}
        </div>

        {effectiveTab === 'explore' && (
          <div className="flex flex-col gap-2">
            {queryNodes.length === 0 ? (
              <div className="rounded-2xl border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
                No query yet. Add one from a suggestion and run it.
              </div>
            ) : (
              queryNodes.map((q) => {
                const a = answerByQuery.get(q.id);
                const d = a ? dataByAnswer.get(a.id) : null;
                const isRunning = q.status === 'running';
                const canRun = !isRunning;
                return (
                  <div key={q.id} className="rounded-2xl border border-border bg-card p-3 shadow-sm">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
                          Q
                        </span>
                        <span className="text-[11px] text-muted-foreground">{q.status}</span>
                      </div>
                      <button
                        type="button"
                        disabled={!canRun}
                        onClick={() => runQuery(q.id)}
                        className="rounded-lg bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground disabled:opacity-50"
                      >
                        {isRunning ? t('nodes.running') : t('nodes.run')}
                      </button>
                    </div>
                    <p className="mb-2 text-[15px] leading-snug text-foreground">{q.question}</p>
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                        {modelLabel(q)}
                      </span>
                      <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                        Tool: {q.toolChoice ?? 'auto'}
                      </span>
                    </div>

                    {a && (
                      <div className="mt-2 rounded-xl border border-border bg-secondary/40 p-2.5">
                        <div className="mb-1 flex items-center justify-between">
                          <span className="rounded-full bg-lime-400/20 px-2 py-0.5 text-[11px] font-semibold text-lime-600">
                            A
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleDashboardPin(a.id)}
                            className="text-[11px] text-muted-foreground"
                          >
                            {state.dashboardNodeIds.includes(a.id) ? 'Unpin' : 'Pin'}
                          </button>
                        </div>
                        <p className="line-clamp-5 text-[13px] leading-relaxed text-foreground/90">
                          {a.content || '...'}
                        </p>
                        {a.suggestedQueries.length > 0 && (
                          <div className="mt-2 flex flex-col gap-1.5">
                            {a.suggestedQueries.slice(0, 2).map((sq) => (
                              <button
                                key={sq}
                                type="button"
                                onClick={() =>
                                  addCustomQuery(
                                    sq,
                                    a.id,
                                    a.position,
                                    q.modelChoice ?? aiCatalog?.defaultChoice,
                                    q.toolChoice ?? 'auto'
                                  )
                                }
                                className="rounded-lg border border-border px-2 py-1 text-left text-[12px] text-muted-foreground"
                              >
                                + {sq}
                              </button>
                            ))}
                            <div className="flex gap-1.5">
                              <input
                                value={customInputByAnswer[a.id] ?? ''}
                                onChange={(e) =>
                                  setCustomInputByAnswer((prev) => ({ ...prev, [a.id]: e.target.value }))
                                }
                                placeholder={t('nodes.askPlaceholder')}
                                className="flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-[12px] outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const text = (customInputByAnswer[a.id] ?? '').trim();
                                  if (!text) return;
                                  addCustomQuery(
                                    text,
                                    a.id,
                                    a.position,
                                    q.modelChoice ?? aiCatalog?.defaultChoice,
                                    q.toolChoice ?? 'auto'
                                  );
                                  setCustomInputByAnswer((prev) => ({ ...prev, [a.id]: '' }));
                                }}
                                className="rounded-lg border border-border px-2.5 py-1.5 text-[12px] text-foreground"
                              >
                                Add
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {d && (
                      <div className="mt-2 rounded-xl border border-border bg-amber-500/5 p-2.5">
                        <div className="mb-1 flex items-center justify-between">
                          <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[11px] font-semibold text-amber-600">
                            Data
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleDashboardPin(d.id)}
                            className="text-[11px] text-muted-foreground"
                          >
                            {state.dashboardNodeIds.includes(d.id) ? 'Unpin' : 'Pin'}
                          </button>
                        </div>
                        <p className="text-xs text-foreground/80">{dataSummary(d)}</p>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {effectiveTab === 'dashboard' && (
          <div className="flex flex-col gap-2">
            {pinned.length === 0 ? (
              <div className="rounded-2xl border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
                No pinned cards yet.
              </div>
            ) : (
              pinned.map((n) => (
                <div key={n.id} className="rounded-2xl border border-border bg-card p-3">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">
                      {n.type === 'answer' ? 'Answer Card' : n.type === 'data' ? 'Data Card' : 'Card'}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleDashboardPin(n.id)}
                      className="text-[11px] text-muted-foreground"
                    >
                      Remove
                    </button>
                  </div>
                  <p className="line-clamp-5 text-xs text-muted-foreground">
                    {n.type === 'answer'
                      ? n.content
                      : n.type === 'data'
                        ? dataSummary(n)
                        : 'Pinned node'}
                  </p>
                </div>
              ))
            )}
          </div>
        )}

      </div>
    </div>
  );
}

function dataSummary(d: DataNodeData): string {
  if (d.subtitle?.trim()) return d.subtitle.trim();
  if (d.dataType === 'metric' && d.metrics?.length) {
    return d.metrics.map((m) => `${m.label}: ${m.value}`).join(' | ');
  }
  if (d.dataType === 'list' && d.listItems?.length) {
    return d.listItems.slice(0, 3).join(' · ');
  }
  if (d.dataType === 'table' && d.tableRows?.length) {
    return `${d.tableRows.length} rows`;
  }
  if ((d.dataType === 'line-chart' || d.dataType === 'bar-chart') && d.chartData?.length) {
    return `${d.chartData.length} points`;
  }
  return d.title;
}
