'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { AnswerNodeData } from '@/lib/types';
import { FOCUS_QUERY_NODE_EVENT, useWorkspace } from '@/lib/workspace-store';
import {
  findQueryIdByParentAndQuestion,
  listChildQueriesOrdered,
  normalizeIntroQuestion,
  useIntroduceReveal,
} from '@/lib/introduce-reveal-context';
import { useI18n } from '@/components/i18n-provider';
import { getClientTtsProvider } from '@/lib/tts/config';
import { RefreshCw } from 'lucide-react';

interface Props {
  node: AnswerNodeData;
}

export function AnswerNode({ node }: Props) {
  const { t, locale } = useI18n();
  const { addCustomQuery, state, aiCatalog, isDemoMode, refreshAnswerMetadata } =
    useWorkspace();
  const introduceReveal = useIntroduceReveal();
  const [showAllKeywords, setShowAllKeywords] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customQ, setCustomQ] = useState('');
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const [metaRefreshing, setMetaRefreshing] = useState(false);
  const browserUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const parentQuery = state.nodes.find((n) => n.id === node.queryId);
  const inheritedModelChoice =
    parentQuery?.type === 'query'
      ? parentQuery.modelChoice ?? aiCatalog?.defaultChoice
      : undefined;
  const inheritedToolChoice = parentQuery?.type === 'query' ? parentQuery.toolChoice ?? 'auto' : 'auto';

  const displayText =
    node.status === 'streaming' && node.streamedChars !== undefined
      ? node.content.slice(0, node.streamedChars)
      : node.content;

  const isStreaming = node.status === 'streaming';
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

  const stopTts = () => {
    if (ttsProvider === 'browser' && typeof window !== 'undefined') {
      window.speechSynthesis.cancel();
      browserUtteranceRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setTtsPlaying(false);
  };

  const playTts = async () => {
    const text = displayText.trim();
    if (!text || isStreaming) return;
    if (ttsPlaying) {
      stopTts();
      return;
    }

    if (ttsProvider === 'browser') {
      if (typeof window === 'undefined' || !window.speechSynthesis) {
        return;
      }
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
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.onend = () => setTtsPlaying(false);
      utterance.onerror = () => {
        setTtsPlaying(false);
      };
      browserUtteranceRef.current = utterance;
      setTtsPlaying(true);
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
      return;
    }

    try {
      setTtsPlaying(true);
      const prep = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.slice(0, 900) }),
      });
      if (!prep.ok) {
        setTtsPlaying(false);
        return;
      }
      const prepJson = (await prep.json().catch(() => ({}))) as { streamUrl?: string };
      if (!prepJson.streamUrl) {
        setTtsPlaying(false);
        return;
      }
      const audio = new Audio(prepJson.streamUrl);
      audioRef.current = audio;
      audio.onended = () => {
        setTtsPlaying(false);
        audioRef.current = null;
      };
      audio.onerror = () => {
        setTtsPlaying(false);
        audioRef.current = null;
      };
      await audio.play();
    } catch {
      setTtsPlaying(false);
    }
  };

  // Format bold markdown
  const formattedText = displayText
    .split('\n\n')
    .map((para, i) => (
      <p key={i} className="mb-2 last:mb-0 text-sm leading-relaxed text-foreground/90">
        {formatBold(para)}
      </p>
    ));

  const visibleKeywords = showAllKeywords
    ? node.extractedKeywords
    : node.extractedKeywords.slice(0, 4);

  const submitCustomQuery = () => {
    const q = customQ.trim();
    if (!q) return;
    addCustomQuery(q, node.id, node.position, inheritedModelChoice, inheritedToolChoice);
    setCustomQ('');
    setShowCustomInput(false);
  };

  const followUpChildrenOrdered = useMemo(
    () => listChildQueriesOrdered(state.nodes, node.id),
    [state.nodes, node.id]
  );
  // Keyed by normalized question text (not array position) — a child's index among its siblings
  // doesn't line up with its index in `suggestedQueries` once questions are answered out of order
  // or a custom question is added.
  const followUpChildrenByText = useMemo(
    () =>
      new Map(followUpChildrenOrdered.map((child) => [normalizeIntroQuestion(child.question), child] as const)),
    [followUpChildrenOrdered]
  );

  return (
    <div
      className="flex min-w-0 max-w-full flex-col gap-3 rounded-2xl border p-4 transition-all duration-300"
      style={{
        borderColor: 'rgba(163,230,53,0.25)',
        background: 'rgba(163,230,53,0.03)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
        backdropFilter: 'blur(8px)',
        maxWidth: 340,
        minWidth: 280,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold"
            style={{ background: '#A3E635', color: '#080C12' }}
          >
            A
          </span>
          <span className="text-xs font-medium" style={{ color: '#A3E635' }}>
            {isStreaming ? 'Generating...' : 'Answer'}
          </span>
        </div>

        {/* Actions */}
        {!isStreaming && (
          <div className="flex flex-wrap items-center justify-end gap-1">
            {!isDemoMode && (
              <button
                type="button"
                disabled={metaRefreshing}
                onClick={() => {
                  setMetaRefreshing(true);
                  void refreshAnswerMetadata(node.id).finally(() => setMetaRefreshing(false));
                }}
                className="flex items-center gap-1 rounded-lg border px-2 py-1 text-xs transition-colors disabled:opacity-50"
                style={{
                  color: 'var(--muted-foreground)',
                  borderColor: 'rgba(163,230,53,0.25)',
                  background: 'rgba(255,255,255,0.02)',
                }}
                title={t('nodes.refreshKeywords')}
              >
                <RefreshCw className={`size-3 ${metaRefreshing ? 'animate-spin' : ''}`} aria-hidden />
                <span className="hidden sm:inline">{t('nodes.refreshKeywordsShort')}</span>
              </button>
            )}
            <button
              onClick={() => void playTts()}
              className="flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs transition-colors"
              style={{
                color: ttsPlaying ? '#00C49A' : 'var(--muted-foreground)',
                borderColor: 'rgba(163,230,53,0.25)',
                background: ttsPlaying ? 'rgba(0,196,154,0.1)' : 'rgba(255,255,255,0.02)',
              }}
              title={ttsPlaying ? t('nodes.ttsStop') : t('nodes.ttsPlay')}
            >
              {ttsPlaying ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="5" y="4" width="5" height="16" rx="1" />
                  <rect x="14" y="4" width="5" height="16" rx="1" />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="6,4 20,12 6,20" />
                </svg>
              )}
              <span>{ttsPlaying ? t('nodes.ttsStop') : t('nodes.ttsPlay')}</span>
            </button>
          </div>
        )}
      </div>

      {/* Answer content */}
      <div
        className="max-h-52 overflow-y-auto pr-1 select-text"
        data-node-scroll="true"
        data-node-interactive="true"
        style={{
          scrollbarWidth: 'thin',
          touchAction: 'pan-y',
          overscrollBehavior: 'contain',
          userSelect: 'text',
          WebkitUserSelect: 'text',
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {formattedText}
        {isStreaming && (
          <span
            className="inline-block h-3.5 w-0.5 align-middle"
            style={{ background: '#A3E635', animation: 'blink-cursor 0.8s step-end infinite' }}
          />
        )}
      </div>

      {/* Extracted keywords */}
      {!isStreaming && node.extractedKeywords.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">Extracted concepts</span>
          <div className="flex flex-wrap gap-1.5">
            {visibleKeywords.map((kw) => (
              <button
                key={kw}
                onClick={() =>
                  addCustomQuery(
                    `What is ${kw} in this context?`,
                    node.id,
                    node.position,
                    inheritedModelChoice,
                    inheritedToolChoice
                  )
                }
                className="rounded-full border px-2.5 py-0.5 text-xs transition-all"
                style={{ borderColor: 'rgba(163,230,53,0.3)', color: '#A3E635' }}
                onMouseOver={(e) =>
                  Object.assign((e.currentTarget as HTMLElement).style, {
                    background: 'rgba(163,230,53,0.1)',
                  })
                }
                onMouseOut={(e) =>
                  Object.assign((e.currentTarget as HTMLElement).style, {
                    background: 'transparent',
                  })
                }
                title={`Explore: ${kw}`}
              >
                {kw}
              </button>
            ))}
            {node.extractedKeywords.length > 4 && (
              <button
                onClick={() => setShowAllKeywords(!showAllKeywords)}
                className="rounded-full px-2.5 py-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {showAllKeywords ? 'less' : `+${node.extractedKeywords.length - 4} more`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Suggested follow-up queries */}
      {!isStreaming && node.suggestedQueries.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t pt-3" style={{ borderColor: 'rgba(163,230,53,0.15)' }}>
          <span className="text-xs text-muted-foreground">Follow-up queries</span>
          <div className="flex flex-col gap-1">
            {node.suggestedQueries.slice(0, 2).map((q, idx) => {
              const linked = followUpChildrenByText.get(normalizeIntroQuestion(q));
              const spawning = !linked;
              const running = linked?.status === 'running';
              const clickable = Boolean(introduceReveal) || !isDemoMode || idx === 0;
              const followUpGlow =
                (isDemoMode && idx === 0 && !introduceReveal) ||
                (!!introduceReveal &&
                  introduceReveal.spotlightAnswerId === node.id &&
                  idx === 0);

              const spawnOrRun = () => {
                if (running || !clickable) return;
                if (linked) {
                  if (introduceReveal) {
                    introduceReveal.revealAndRunQuery(linked.id);
                    return;
                  }
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(
                      new CustomEvent(FOCUS_QUERY_NODE_EVENT, { detail: { queryId: linked.id } })
                    );
                  }
                  return;
                }
                if (introduceReveal) {
                  const existing = findQueryIdByParentAndQuestion(state.nodes, node.id, q);
                  if (existing) {
                    introduceReveal.revealAndRunQuery(existing);
                    return;
                  }
                }
                addCustomQuery(
                  q,
                  node.id,
                  node.position,
                  inheritedModelChoice,
                  inheritedToolChoice,
                  true
                );
              };

              return (
                <div
                  key={`${node.id}-followup-${idx}`}
                  className={[
                    'flex items-start gap-2 rounded-xl p-2 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
                    followUpGlow
                      ? 'border border-primary/35 bg-primary/5 shadow-sm'
                      : '',
                  ].join(' ')}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      spawnOrRun();
                    }}
                    disabled={running || !clickable}
                    className={[
                      'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                      clickable ? 'shadow-[0_0_10px_rgba(0,196,154,0.22)]' : '',
                    ].join(' ')}
                    style={
                      spawning
                        ? {
                            color: 'var(--muted-foreground)',
                            border: '1px solid rgba(163,230,53,0.25)',
                          }
                        : {
                            background: 'rgba(0,196,154,0.12)',
                            color: '#00C49A',
                            border: '1px solid rgba(0,196,154,0.35)',
                          }
                    }
                    title={spawning ? t('nodes.spawnFollowUp') : t('nodes.run')}
                  >
                    {spawning ? (
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    ) : (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="5,3 19,12 5,21" />
                      </svg>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={spawnOrRun}
                    disabled={running || !clickable}
                    className={[
                      'min-w-0 flex-1 text-left leading-relaxed transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50',
                      clickable ? 'text-foreground' : '',
                    ].join(' ')}
                  >
                    {q}
                  </button>
                </div>
              );
            })}
            {!isDemoMode && (
              <button
                onClick={() => setShowCustomInput((v) => !v)}
                className="mt-0.5 self-start rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                {t('nodes.addCustom')}
              </button>
            )}
            {!isDemoMode && showCustomInput && (
              <div className="mt-1 flex gap-2">
                <input
                  autoFocus
                  value={customQ}
                  onChange={(e) => setCustomQ(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      submitCustomQuery();
                    }
                    if (e.key === 'Escape') {
                      setShowCustomInput(false);
                    }
                  }}
                  placeholder={t('nodes.askPlaceholder')}
                  className="flex-1 rounded-xl border border-border bg-secondary px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={submitCustomQuery}
                  className="rounded-xl px-3 py-1.5 text-xs font-semibold"
                  style={{ background: '#00C49A', color: '#080C12' }}
                >
                  {t('nodes.add')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

function formatBold(text: string): React.ReactNode[] {
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
