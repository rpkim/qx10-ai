'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AnswerNodeData,
  DataNodeData,
  QueryNodeData,
  QueryTemplateNodeData,
  RootNodeData,
  TemplateSlotNodeData,
  WorkspaceNode,
} from '@/lib/types';
import { FOCUS_QUERY_NODE_EVENT, useWorkspace } from '@/lib/workspace-store';
import {
  findQueryIdByParentAndQuestion,
  listChildQueriesOrdered,
  useIntroduceReveal,
} from '@/lib/introduce-reveal-context';
import { useI18n } from '@/components/i18n-provider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RootNode } from '@/components/nodes/root-node';
import { DashboardWidget } from '@/components/workspace/dashboard-panel';
import { getClientTtsProvider } from '@/lib/tts/config';

interface Props {
  showDashboard: boolean;
  isMobile: boolean;
  /** When true, omit top offset meant for the workspace toolbar (embedded landing / intro layouts). */
  embedded?: boolean;
}

export function MobileWorkspaceShell({ showDashboard, isMobile, embedded = false }: Props) {
  const { t, locale } = useI18n();
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
  const [ttsPlayingAnswerId, setTtsPlayingAnswerId] = useState<string | null>(null);
  const browserUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ttsProvider = getClientTtsProvider();

  useEffect(() => {
    return () => {
      if (browserUtteranceRef.current && typeof window !== 'undefined') {
        window.speechSynthesis.cancel();
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const stopTts = useCallback(() => {
    if (ttsProvider === 'browser' && typeof window !== 'undefined') {
      window.speechSynthesis.cancel();
      browserUtteranceRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setTtsPlayingAnswerId(null);
  }, [ttsProvider]);

  const playAnswerTts = useCallback(
    async (answer: AnswerNodeData) => {
      const text = answer.content.trim();
      if (!text || answer.status === 'streaming') return;
      if (ttsPlayingAnswerId === answer.id) {
        stopTts();
        return;
      }
      stopTts();

      if (ttsProvider === 'browser') {
        if (typeof window === 'undefined' || !window.speechSynthesis) return;
        const utterance = new SpeechSynthesisUtterance(text.slice(0, 900));
        utterance.lang =
          locale === 'ko'
            ? 'ko-KR'
            : locale === 'ja'
              ? 'ja-JP'
              : locale === 'zh'
                ? 'zh-CN'
                : locale === 'es'
                  ? 'es-ES'
                  : 'en-US';
        utterance.onend = () => setTtsPlayingAnswerId(null);
        utterance.onerror = () => setTtsPlayingAnswerId(null);
        browserUtteranceRef.current = utterance;
        setTtsPlayingAnswerId(answer.id);
        window.speechSynthesis.speak(utterance);
        return;
      }

      try {
        setTtsPlayingAnswerId(answer.id);
        const prep = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: text.slice(0, 900) }),
        });
        if (!prep.ok) {
          setTtsPlayingAnswerId(null);
          return;
        }
        const prepJson = (await prep.json().catch(() => ({}))) as { streamUrl?: string };
        if (!prepJson.streamUrl) {
          setTtsPlayingAnswerId(null);
          return;
        }
        const audio = new Audio(prepJson.streamUrl);
        audioRef.current = audio;
        audio.onended = () => {
          setTtsPlayingAnswerId(null);
          audioRef.current = null;
        };
        audio.onerror = () => {
          setTtsPlayingAnswerId(null);
          audioRef.current = null;
        };
        await audio.play();
      } catch {
        setTtsPlayingAnswerId(null);
      }
    },
    [locale, stopTts, ttsPlayingAnswerId, ttsProvider]
  );

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
  const queryHierarchy = useMemo(() => {
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
    const sortByCreated = (a: QueryNodeData, b: QueryNodeData) => createdAt(b.id) - createdAt(a.id);
    roots.sort((a, b) => {
      const aFromTemplate = !!a.parentId && templateIdSet.has(a.parentId);
      const bFromTemplate = !!b.parentId && templateIdSet.has(b.parentId);
      if (aFromTemplate !== bFromTemplate) return aFromTemplate ? -1 : 1;
      if (aFromTemplate && bFromTemplate) return sortByCreated(a, b);
      return sortByCreated(a, b);
    });
    for (const arr of childrenMap.values()) arr.sort(sortByCreated);

    const out: QueryNodeData[] = [];
    const walk = (q: QueryNodeData) => {
      out.push(q);
      for (const child of childrenMap.get(q.id) ?? []) walk(child);
    };
    for (const r of roots) walk(r);
    return { ordered: out, parentById: parentQueryByQuery };
  }, [queryNodes, state.nodes, templateNodes]);
  const orderedQueryNodes = queryHierarchy.ordered;
  const visibleOrderedQueryNodes = useMemo(
    () =>
      orderedQueryNodes.filter((q) => {
        let parentId = queryHierarchy.parentById.get(q.id) ?? null;
        while (parentId) {
          if (collapsedByQuery[parentId]) return false;
          parentId = queryHierarchy.parentById.get(parentId) ?? null;
        }
        return true;
      }),
    [orderedQueryNodes, queryHierarchy.parentById, collapsedByQuery]
  );

  const introduceReveal = useIntroduceReveal();
  const cardQueryRows = useMemo(() => {
    if (!introduceReveal) return visibleOrderedQueryNodes;
    return visibleOrderedQueryNodes.filter((q) =>
      introduceReveal.isQueryCardVisible(q.id, queryHierarchy.parentById)
    );
  }, [introduceReveal, visibleOrderedQueryNodes, queryHierarchy.parentById]);

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

  const modelLabel = (q: QueryNodeData): string => {
    const id = q.modelChoice ?? aiCatalog?.defaultChoice ?? '';
    return aiCatalog?.options.find((o) => o.id === id)?.label ?? (id || 'Default');
  };
  const scrollToQueryCard = useCallback((queryId: string, delayMs = 40) => {
    const selector = `[data-mobile-query-card-id="${queryId}"]`;
    const tryScroll = (attempt = 0) => {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return;
      }
      if (attempt >= 10) return;
      window.setTimeout(() => tryScroll(attempt + 1), 80);
    };
    window.setTimeout(() => tryScroll(0), delayMs);
  }, []);

  useEffect(() => {
    const onFocusQuery = (e: Event) => {
      const id = (e as CustomEvent<{ queryId?: string }>).detail?.queryId;
      if (id) scrollToQueryCard(id);
    };
    window.addEventListener(FOCUS_QUERY_NODE_EVENT, onFocusQuery as EventListener);
    return () => window.removeEventListener(FOCUS_QUERY_NODE_EVENT, onFocusQuery as EventListener);
  }, [scrollToQueryCard]);

  return (
    <div
      className={[
        'absolute inset-0 overflow-y-auto bg-background',
        embedded
          ? 'top-0 pb-8 pt-1'
          : isMobile
            ? 'top-[calc(env(safe-area-inset-top)+6.75rem)] pb-[max(6rem,env(safe-area-inset-bottom))]'
            : 'top-20 pb-6',
      ].join(' ')}
    >
      <div
        className={[
          'mx-auto flex w-full flex-col gap-3 px-3 py-3',
          isMobile ? 'max-w-xl' : 'max-w-5xl',
        ].join(' ')}
      >
        {!showDashboard && (
          <div className="flex flex-col gap-2">
            {rootNode && (
              <div className="mb-1 flex justify-center">
                <RootNode node={rootNode} />
              </div>
            )}
            {introduceReveal && orderedQueryNodes.length > 0 && cardQueryRows.length === 0 && (
              <p className="px-1 text-center text-xs text-muted-foreground">
                Tap a suggestion on ROOT to reveal a question card.
              </p>
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
              cardQueryRows.map((q) => {
                const a = answerByQuery.get(q.id);
                const answerFollowUpChildren = a ? listChildQueriesOrdered(state.nodes, a.id) : [];
                const d = a ? dataByAnswer.get(a.id) : null;
                const isRunning = q.status === 'running';
                const canRun = !isRunning;
                const isCollapsed = !!collapsedByQuery[q.id];
                return (
                  <div
                    key={q.id}
                    data-mobile-query-card-id={q.id}
                    className="rounded-2xl border border-border bg-card p-3 shadow-sm"
                  >
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
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => void playAnswerTts(a)}
                                  className="rounded border border-border px-2 py-0.5 text-[11px] text-muted-foreground"
                                >
                                  {ttsPlayingAnswerId === a.id ? t('nodes.ttsStop') : t('nodes.ttsPlay')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => toggleDashboardPin(a.id)}
                                  className="text-[11px] text-muted-foreground"
                                >
                                  {state.dashboardNodeIds.includes(a.id) ? 'Unpin' : 'Pin'}
                                </button>
                              </div>
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
                              {a.status === 'streaming' && !(a.content || '').trim() ? (
                                <div className="flex items-center gap-2 py-6 text-muted-foreground">
                                  <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-primary/40 border-t-primary" />
                                  <span className="text-xs font-medium">Running…</span>
                                </div>
                              ) : (
                                renderSimpleMarkdown(a.content || '...')
                              )}
                            </div>
                            {a.suggestedQueries.length > 0 && a.status === 'complete' && (
                              <div className="mt-2 flex flex-col gap-1.5">
                                {a.suggestedQueries.slice(0, 2).map((sq, sqIdx) => {
                                  const introFollowGlow =
                                    introduceReveal?.spotlightAnswerId === a.id && sqIdx === 0;
                                  const followUpByIndex = answerFollowUpChildren[sqIdx];
                                  return (
                                    <button
                                      key={`${a.id}-followup-${sqIdx}`}
                                      type="button"
                                      onClick={() => {
                                        if (introduceReveal) {
                                          if (followUpByIndex) {
                                            introduceReveal.revealAndRunQuery(followUpByIndex.id);
                                            scrollToQueryCard(followUpByIndex.id, 160);
                                            return;
                                          }
                                          const existing = findQueryIdByParentAndQuestion(
                                            state.nodes,
                                            a.id,
                                            sq
                                          );
                                          if (existing) {
                                            introduceReveal.revealAndRunQuery(existing);
                                            scrollToQueryCard(existing, 160);
                                            return;
                                          }
                                        }
                                        const newId = addCustomQuery(
                                          sq,
                                          a.id,
                                          a.position,
                                          q.modelChoice ?? aiCatalog?.defaultChoice,
                                          q.toolChoice ?? 'auto',
                                          true
                                        );
                                        scrollToQueryCard(newId, 160);
                                      }}
                                      className={[
                                        'rounded-lg border px-2 py-1 text-left text-[12px] transition-colors',
                                        introFollowGlow
                                          ? 'border-primary/60 bg-primary/10 text-foreground shadow-sm'
                                          : 'border-border text-muted-foreground',
                                      ].join(' ')}
                                    >
                                      + {sq}
                                    </button>
                                  );
                                })}
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
                                      if (introduceReveal) {
                                        const existing = findQueryIdByParentAndQuestion(
                                          state.nodes,
                                          a.id,
                                          text
                                        );
                                        if (existing) {
                                          introduceReveal.revealAndRunQuery(existing);
                                          scrollToQueryCard(existing, 160);
                                          setCustomInputByAnswer((prev) => ({ ...prev, [a.id]: '' }));
                                          return;
                                        }
                                      }
                                      const newId = addCustomQuery(
                                        text,
                                        a.id,
                                        a.position,
                                        q.modelChoice ?? aiCatalog?.defaultChoice,
                                        q.toolChoice ?? 'auto'
                                      );
                                      scrollToQueryCard(newId, 160);
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

                        {d && a?.status === 'complete' && (
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
                            {d.dataType === 'table' && d.tableRows && d.tableColumns ? (
                              <div className="overflow-x-auto rounded-lg border border-border bg-card/70">
                                <table className="w-full min-w-[360px] text-xs">
                                  <thead>
                                    <tr>
                                      {d.tableColumns.map((col) => (
                                        <th
                                          key={col}
                                          className="border-b border-border px-2 py-1.5 text-left font-semibold text-muted-foreground"
                                        >
                                          {col}
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {d.tableRows.slice(0, 8).map((row, idx) => (
                                      <tr key={idx}>
                                        {d.tableColumns.map((col) => (
                                          <td
                                            key={col}
                                            className="border-b border-border px-2 py-1.5 text-foreground/85"
                                          >
                                            {String(row[col] ?? '')}
                                          </td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <p className="text-xs text-foreground/80">{dataSummary(d)}</p>
                            )}
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

        {showDashboard && (
          <div className="flex flex-col gap-3 pb-2">
            {pinned.length === 0 ? (
              <div className="rounded-2xl border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">{t('dashboard.emptyTitle')}</p>
                <p className="mt-2 text-xs leading-relaxed">{t('dashboard.emptyDesc')}</p>
              </div>
            ) : (
              pinned.map((n) => (
                <div
                  key={n.id}
                  className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
                >
                  <DashboardWidget
                    node={n}
                    onUnpin={() => toggleDashboardPin(n.id)}
                    compact
                  />
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

function renderSimpleMarkdown(content: string): JSX.Element {
  const blocks = content.split('\n\n').filter((b) => b.trim().length > 0);
  return (
    <div className="space-y-2">
      {blocks.map((block, idx) => {
        const trimmed = block.trim();
        const lines = trimmed.split('\n').filter(Boolean);
        const isList = lines.length > 0 && lines.every((line) => /^\s*[-*]\s+/.test(line));
        const isOrderedList = lines.length > 0 && lines.every((line) => /^\s*\d+\.\s+/.test(line));
        const inlineOrderedItems =
          !isOrderedList && /^\d+\.\s+/.test(trimmed)
            ? trimmed
                .split(/(?=\s*\d+\.\s+)/)
                .map((x) => x.trim())
                .filter((x) => /^\d+\.\s+/.test(x))
            : [];
        const isMarkdownTable =
          lines.length >= 2 &&
          /^\s*\|?(.+\|)+.+\|?\s*$/.test(lines[0]) &&
          /^\s*\|?[\s:-]+(\|[\s:-]+)+\|?\s*$/.test(lines[1]);

        if (isMarkdownTable) {
          const toCells = (line: string) =>
            line
              .trim()
              .replace(/^\|/, '')
              .replace(/\|$/, '')
              .split('|')
              .map((cell) => cell.trim());
          const headers = toCells(lines[0]);
          const rows = lines.slice(2).map(toCells);
          return (
            <div key={idx} className="overflow-x-auto rounded-lg border border-border bg-card/70">
              <table className="w-full min-w-[360px] text-xs">
                <thead>
                  <tr>
                    {headers.map((h, hIdx) => (
                      <th key={hIdx} className="border-b border-border px-2 py-1.5 text-left font-semibold text-muted-foreground">
                        {formatBoldInline(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIdx) => (
                    <tr key={rowIdx}>
                      {headers.map((_, colIdx) => (
                        <td key={colIdx} className="border-b border-border px-2 py-1.5 text-foreground/85">
                          {formatBoldInline(row[colIdx] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        if (isList) {
          return (
            <ul key={idx} className="ml-4 list-disc space-y-1">
              {lines.map((line, lineIdx) => (
                <li key={lineIdx}>{formatBoldInline(line.replace(/^\s*[-*]\s+/, ''))}</li>
              ))}
            </ul>
          );
        }

        if (isOrderedList || inlineOrderedItems.length > 1) {
          const items = isOrderedList
            ? lines.map((line) => line.replace(/^\s*\d+\.\s+/, ''))
            : inlineOrderedItems.map((line) => line.replace(/^\s*\d+\.\s+/, ''));
          return (
            <ol key={idx} className="ml-4 list-decimal space-y-1">
              {items.map((item, itemIdx) => (
                <li key={itemIdx}>{formatBoldInline(item)}</li>
              ))}
            </ol>
          );
        }

        if (/^###\s+/.test(trimmed)) {
          return (
            <h4 key={idx} className="text-sm font-semibold text-foreground">
              {formatBoldInline(trimmed.replace(/^###\s+/, ''))}
            </h4>
          );
        }
        if (/^##\s+/.test(trimmed)) {
          return (
            <h3 key={idx} className="text-sm font-semibold text-foreground">
              {formatBoldInline(trimmed.replace(/^##\s+/, ''))}
            </h3>
          );
        }
        if (/^#\s+/.test(trimmed)) {
          return (
            <h2 key={idx} className="text-base font-semibold text-foreground">
              {formatBoldInline(trimmed.replace(/^#\s+/, ''))}
            </h2>
          );
        }

        return (
          <p key={idx} className="text-[13px] leading-relaxed text-foreground/90">
            {formatBoldInline(trimmed)}
          </p>
        );
      })}
    </div>
  );
}

function formatBoldInline(text: string): (string | JSX.Element)[] {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold text-foreground">
        {part}
      </strong>
    ) : (
      part
    )
  );
}
