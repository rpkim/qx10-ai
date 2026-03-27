'use client';

import { useMemo, useState } from 'react';
import type {
  AnswerNodeData,
  DataNodeData,
  QueryNodeData,
  QueryTemplateNodeData,
  RootNodeData,
  TemplateSlotNodeData,
  WorkspaceNode,
} from '@/lib/types';
import { useWorkspace } from '@/lib/workspace-store';
import { useI18n } from '@/components/i18n-provider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RootNode } from '@/components/nodes/root-node';

type MobileTab = 'explore' | 'dashboard';

interface Props {
  showDashboard: boolean;
  onShowDashboardChange: (show: boolean) => void;
  isMobile: boolean;
}

export function MobileWorkspaceShell({ showDashboard, onShowDashboardChange, isMobile }: Props) {
  const { t } = useI18n();
  const {
    state,
    dispatch,
    runQuery,
    addCustomQuery,
    toggleDashboardPin,
    aiCatalog,
    addTemplateSlotNode,
    runTemplateSlot,
    deleteTemplateSlotNode,
    deleteNode,
  } = useWorkspace();
  const [customInputByAnswer, setCustomInputByAnswer] = useState<Record<string, string>>({});
  const [collapsedByQuery, setCollapsedByQuery] = useState<Record<string, boolean>>({});
  const [collapsedExecutedByTemplate, setCollapsedExecutedByTemplate] = useState<
    Record<string, boolean>
  >({});
  const [activeTab, setActiveTab] = useState<MobileTab>('explore');

  const queryNodes = useMemo(
    () => state.nodes.filter((n): n is QueryNodeData => n.type === 'query'),
    [state.nodes]
  );
  const templateNodes = useMemo(
    () =>
      state.nodes
        .filter((n): n is QueryTemplateNodeData => n.type === 'query-template')
        .sort((a, b) => a.templateName.localeCompare(b.templateName)),
    [state.nodes]
  );
  const slotNodes = useMemo(
    () => state.nodes.filter((n): n is TemplateSlotNodeData => n.type === 'template-slot'),
    [state.nodes]
  );
  const rootNode = useMemo(
    () => state.nodes.find((n): n is RootNodeData => n.type === 'root') ?? null,
    [state.nodes]
  );

  const answerByQuery = useMemo(() => {
    const map = new Map<string, AnswerNodeData>();
    for (const n of state.nodes) {
      if (n.type === 'answer') map.set(n.queryId, n);
    }
    return map;
  }, [state.nodes]);
  const orderedQueryNodes = useMemo(() => {
    const queryById = new Map(queryNodes.map((q) => [q.id, q]));
    const templateIdSet = new Set(templateNodes.map((t) => t.id));
    const answerOwnerById = new Map<string, string>();
    for (const n of state.nodes) {
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

    const childrenMap = new Map<string, QueryNodeData[]>();
    const roots: QueryNodeData[] = [];
    for (const q of queryNodes) {
      const p = parentQueryByQuery.get(q.id);
      if (!p) {
        roots.push(q);
      } else {
        const arr = childrenMap.get(p) ?? [];
        arr.push(q);
        childrenMap.set(p, arr);
      }
    }

    const createdAt = (id: string) => Number(id.match(/(\d{10,})/)?.[1] ?? 0);
    const sortByCreated = (a: QueryNodeData, b: QueryNodeData) => createdAt(a.id) - createdAt(b.id);
    roots.sort((a, b) => {
      const aFromTemplate = !!a.parentId && templateIdSet.has(a.parentId);
      const bFromTemplate = !!b.parentId && templateIdSet.has(b.parentId);
      if (aFromTemplate !== bFromTemplate) return aFromTemplate ? -1 : 1;
      if (aFromTemplate && bFromTemplate) {
        return createdAt(b.id) - createdAt(a.id);
      }
      return sortByCreated(a, b);
    });
    for (const arr of childrenMap.values()) arr.sort(sortByCreated);

    const out: QueryNodeData[] = [];
    const walk = (q: QueryNodeData) => {
      out.push(q);
      for (const child of childrenMap.get(q.id) ?? []) walk(child);
    };
    for (const r of roots) walk(r);
    return out;
  }, [queryNodes, state.nodes, templateNodes]);

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
            {rootNode && (
              <div className="mb-1 flex justify-center">
                <RootNode node={rootNode} />
              </div>
            )}
            {templateNodes.length > 0 && (
              <div className="mb-1 rounded-2xl border border-border bg-card p-3">
                <div className="mb-2 text-xs font-semibold text-muted-foreground">Question Templates</div>
                <div className="flex flex-col gap-2">
                  {templateNodes.map((tpl) => {
                    const slots = slotNodes.filter((s) => s.templateNodeId === tpl.id);
                    const pendingSlots = slots.filter((s) => !s.linkedQueryId);
                    const executedSlots = slots.filter((s) => !!s.linkedQueryId);
                    const executedCollapsed = collapsedExecutedByTemplate[tpl.id] ?? true;
                    const renderSlot = (slot: TemplateSlotNodeData) => (
                      <div key={slot.id} className="rounded-lg border border-border bg-card p-2">
                        {Object.keys(slot.values).length > 0 ? (
                          <div className="mb-1.5 grid grid-cols-1 gap-1.5">
                            {Object.entries(slot.values).map(([key, value]) => (
                              <input
                                key={key}
                                value={value}
                                onChange={(e) =>
                                  dispatch({
                                    type: 'UPDATE_NODE',
                                    id: slot.id,
                                    updates: {
                                      values: { ...slot.values, [key]: e.target.value },
                                    } as Partial<WorkspaceNode>,
                                  })
                                }
                                placeholder={key}
                                className="rounded-md border border-border bg-background px-2 py-1 text-xs outline-none"
                              />
                            ))}
                          </div>
                        ) : (
                          <div className="mb-1.5 text-[11px] text-muted-foreground">No variables</div>
                        )}
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => runTemplateSlot(slot.id)}
                            className="rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground"
                          >
                            Run
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteTemplateSlotNode(slot.id)}
                            className="rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                    return (
                      <div key={tpl.id} className="rounded-xl border border-border bg-secondary/30 p-2.5">
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <div className="text-sm font-semibold text-foreground">{tpl.templateName}</div>
                          <button
                            type="button"
                            onClick={() => addTemplateSlotNode(tpl.id)}
                            className="rounded-lg border border-border px-2 py-1 text-[11px] text-muted-foreground"
                          >
                            + Slot
                          </button>
                        </div>
                        <div className="mb-2 text-xs text-muted-foreground">{tpl.pattern}</div>
                        {pendingSlots.length > 0 && (
                          <div className="flex flex-col gap-1.5">
                            {pendingSlots.map(renderSlot)}
                          </div>
                        )}
                        {executedSlots.length > 0 && (
                          <div className="mt-2">
                            <button
                              type="button"
                              onClick={() =>
                                setCollapsedExecutedByTemplate((prev) => ({
                                  ...prev,
                                  [tpl.id]: !prev[tpl.id],
                                }))
                              }
                              className="mb-1.5 flex w-full items-center justify-between rounded-lg border border-border bg-card px-2 py-1.5 text-left text-[11px] text-muted-foreground"
                            >
                              <span>Executed slots ({executedSlots.length})</span>
                              <svg
                                width="11"
                                height="11"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                style={{
                                  transform: executedCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                                  transition: 'transform 0.15s ease',
                                }}
                              >
                                <polyline points="6 9 12 15 18 9" />
                              </svg>
                            </button>
                            {!executedCollapsed && (
                              <div className="flex flex-col gap-1.5">{executedSlots.map(renderSlot)}</div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {orderedQueryNodes.length === 0 ? (
              <div className="rounded-2xl border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
                No query yet. Add one from a suggestion and run it.
              </div>
            ) : (
              orderedQueryNodes.map((q) => {
                const a = answerByQuery.get(q.id);
                const d = a ? dataByAnswer.get(a.id) : null;
                const isRunning = q.status === 'running';
                const canRun = !isRunning;
                const isCollapsed = !!collapsedByQuery[q.id];
                return (
                  <div key={q.id} className="rounded-2xl border border-border bg-card p-3 shadow-sm">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
                          Q
                        </span>
                        <span className="text-[11px] text-muted-foreground">{q.status}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => deleteNode(q.id)}
                          className="rounded-lg border border-border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:border-destructive/50 hover:text-destructive"
                          title="Delete query"
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setCollapsedByQuery((prev) => ({ ...prev, [q.id]: !prev[q.id] }))
                          }
                          className="flex size-7 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                          title={isCollapsed ? 'Expand' : 'Collapse'}
                        >
                          <svg
                            width="11"
                            height="11"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            style={{
                              transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                              transition: 'transform 0.15s ease',
                            }}
                          >
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          disabled={!canRun}
                          onClick={() => runQuery(q.id)}
                          className="rounded-lg bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground disabled:opacity-50"
                        >
                          {isRunning ? t('nodes.running') : t('nodes.run')}
                        </button>
                      </div>
                    </div>
                    <p className="mb-2 text-[15px] leading-snug text-foreground">{q.question}</p>
                    {!isCollapsed && (
                      <>
                        <div className="mb-2 flex flex-wrap gap-1.5">
                          {aiCatalog && aiCatalog.options.length > 1 ? (
                            <Select
                              value={q.modelChoice ?? aiCatalog.defaultChoice ?? aiCatalog.options[0]?.id ?? ''}
                              onValueChange={(id) =>
                                dispatch({
                                  type: 'UPDATE_NODE',
                                  id: q.id,
                                  updates: { modelChoice: id } as Partial<WorkspaceNode>,
                                })
                              }
                            >
                              <SelectTrigger size="sm" className="h-7 min-w-[140px] max-w-[220px] text-[11px]">
                                <SelectValue placeholder="Model" />
                              </SelectTrigger>
                              <SelectContent>
                                {aiCatalog.options.map((opt) => (
                                  <SelectItem key={opt.id} value={opt.id} className="text-[11px]">
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                              {modelLabel(q)}
                            </span>
                          )}
                          <Select
                            value={q.toolChoice ?? 'auto'}
                            onValueChange={(id) =>
                              dispatch({
                                type: 'UPDATE_NODE',
                                id: q.id,
                                updates: { toolChoice: id as 'auto' | 'web' | 'market' } as Partial<WorkspaceNode>,
                              })
                            }
                          >
                            <SelectTrigger size="sm" className="h-7 w-[110px] text-[11px]">
                              <SelectValue placeholder="Tool" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="auto" className="text-[11px]">Auto</SelectItem>
                              <SelectItem value="web" className="text-[11px]">Web Search</SelectItem>
                              <SelectItem value="market" className="text-[11px]">Stock</SelectItem>
                            </SelectContent>
                          </Select>
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
                            <div
                              className="max-h-52 overflow-y-auto pr-1 text-[13px] leading-relaxed text-foreground/90 select-text"
                              style={{
                                scrollbarWidth: 'thin',
                                overscrollBehavior: 'contain',
                                userSelect: 'text',
                                WebkitUserSelect: 'text',
                              }}
                            >
                              {a.content || '...'}
                            </div>
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
                                        q.toolChoice ?? 'auto',
                                        true
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
                      </>
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
