'use client';

import { useEffect, useMemo, useState } from 'react';
import type { RootNodeData } from '@/lib/types';
import { useWorkspace } from '@/lib/workspace-store';
import {
  findQueryIdByParentAndQuestion,
  listChildQueriesOrdered,
  useIntroduceReveal,
} from '@/lib/introduce-reveal-context';
import { useI18n } from '@/components/i18n-provider';
import { getSuggestedQueries } from '@/lib/mock-data';

const seedSuggestionCache = new Map<string, { questions: string[]; status: 'ai' | 'fallback' }>();
const ROOT_SEED_CACHE_PREFIX = 'qx10.root.seed.v1:';

function readSeedSuggestionsFromStorage(
  cacheKey: string
): { questions: string[]; status: 'ai' | 'fallback' } | null {
  try {
    const raw = window.localStorage.getItem(`${ROOT_SEED_CACHE_PREFIX}${cacheKey}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { questions?: unknown; status?: unknown };
    if (!Array.isArray(parsed.questions)) return null;
    const questions = parsed.questions
      .map((q) => (typeof q === 'string' ? q.trim() : ''))
      .filter(Boolean)
      .slice(0, 6);
    if (questions.length === 0) return null;
    const status = parsed.status === 'ai' ? 'ai' : 'fallback';
    return { questions, status };
  } catch {
    return null;
  }
}

function writeSeedSuggestionsToStorage(
  cacheKey: string,
  payload: { questions: string[]; status: 'ai' | 'fallback' }
) {
  try {
    window.localStorage.setItem(`${ROOT_SEED_CACHE_PREFIX}${cacheKey}`, JSON.stringify(payload));
  } catch {
    // Ignore storage errors (private mode/quota).
  }
}

interface Props {
  node: RootNodeData;
}

export function RootNode({ node }: Props) {
  const { t, locale } = useI18n();
  const { addCustomQuery, isDemoMode, state } = useWorkspace();
  const introduceReveal = useIntroduceReveal();
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customQ, setCustomQ] = useState('');
  const [seedSuggestions, setSeedSuggestions] = useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(true);
  const [suggestionStatus, setSuggestionStatus] = useState<'ai' | 'fallback' | null>(null);

  const sortedRootChildQueries = useMemo(
    () => listChildQueriesOrdered(state.nodes, node.id),
    [state.nodes, node.id]
  );

  /** Stable primitive so effect deps never use an array of objects (avoids variable-length / identity churn). */
  const rootChildQueriesKey = useMemo(
    () => sortedRootChildQueries.map((q) => `${q.id}\u001f${q.question}`).join('\u001e'),
    [sortedRootChildQueries]
  );
  const introduceRevealActive = introduceReveal != null;

  useEffect(() => {
    const cacheKey = `${node.keyword}::${node.context ?? ''}::${node.goal}::${locale}`;

    if (introduceRevealActive) {
      const fromGraphQs = sortedRootChildQueries.map((q) => q.question.trim()).filter(Boolean);
      if (fromGraphQs.length > 0) {
        setSeedSuggestions(fromGraphQs);
        setSuggestionStatus('ai');
        setIsLoadingSuggestions(false);
        return;
      }
      setSeedSuggestions([]);
      setSuggestionStatus('fallback');
      setIsLoadingSuggestions(false);
      return;
    }

    const stored = readSeedSuggestionsFromStorage(cacheKey);
    if (stored) {
      seedSuggestionCache.set(cacheKey, stored);
      setSeedSuggestions(stored.questions);
      setSuggestionStatus(stored.status);
      setIsLoadingSuggestions(false);
      return;
    }
    const cached = seedSuggestionCache.get(cacheKey);
    if (cached) {
      setSeedSuggestions(cached.questions);
      setSuggestionStatus(cached.status);
      setIsLoadingSuggestions(false);
      return;
    }

    let cancelled = false;
    setIsLoadingSuggestions(true);
    setSuggestionStatus(null);
    fetch('/api/workspace/seed-queries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword: node.keyword, goal: node.goal, locale, context: node.context }),
    })
      .then((r) => r.json())
      .then((data: { questions?: string[] }) => {
        if (cancelled) return;
        const qs = Array.isArray(data.questions)
          ? data.questions.map((q) => String(q).trim()).filter(Boolean)
          : [];
        const fallback = getSuggestedQueries(node.keyword).slice(0, 6);
        const looksFallback =
          qs.length === 0 ||
          qs.slice(0, Math.min(qs.length, 3)).every((q, i) => q === (fallback[i] ?? ''));
        if (!looksFallback) {
          const next = qs.slice(0, 6);
          const payload = { questions: next, status: 'ai' as const };
          seedSuggestionCache.set(cacheKey, payload);
          writeSeedSuggestionsToStorage(cacheKey, payload);
          setSeedSuggestions(next);
          setSuggestionStatus('ai');
          setIsLoadingSuggestions(false);
          return;
        }
        const payload = { questions: fallback, status: 'fallback' as const };
        seedSuggestionCache.set(cacheKey, payload);
        writeSeedSuggestionsToStorage(cacheKey, payload);
        setSeedSuggestions(fallback);
        setSuggestionStatus('fallback');
        setIsLoadingSuggestions(false);
      })
      .catch(() => {
        if (cancelled) return;
        const fallback = getSuggestedQueries(node.keyword).slice(0, 6);
        const payload = { questions: fallback, status: 'fallback' as const };
        seedSuggestionCache.set(cacheKey, payload);
        writeSeedSuggestionsToStorage(cacheKey, payload);
        setSeedSuggestions(fallback);
        setSuggestionStatus('fallback');
        setIsLoadingSuggestions(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    node.keyword,
    node.goal,
    node.context,
    node.id,
    locale,
    introduceRevealActive,
    rootChildQueriesKey,
  ]);

  const handleSubmitCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const q = customQ.trim();
    if (!q) return;
    if (introduceReveal) {
      const existing = findQueryIdByParentAndQuestion(state.nodes, node.id, q);
      if (existing) {
        introduceReveal.revealAndRunQuery(existing);
        setCustomQ('');
        setShowCustomInput(false);
        return;
      }
    }
    addCustomQuery(q, node.id, node.position, undefined, 'auto', true);
    setCustomQ('');
    setShowCustomInput(false);
  };

  return (
    <div
      className="relative flex w-full min-w-0 max-w-full flex-col items-center justify-center rounded-2xl border px-4 py-4 sm:px-6"
      style={{
        background: 'linear-gradient(135deg, rgba(0,196,154,0.12), rgba(0,196,154,0.04))',
        borderColor: 'rgba(0,196,154,0.5)',
        boxShadow: '0 0 24px rgba(0,196,154,0.15), 0 4px 20px rgba(0,0,0,0.4)',
        minWidth: 260,
      }}
    >
      {/* Pulse ring */}
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{
          border: '1px solid rgba(0,196,154,0.3)',
          animation: 'socrates-pulse 3s ease-in-out infinite',
        }}
      />

      <div className="flex flex-col items-center gap-2">
        <div
          className="rounded-full px-3 py-1 text-xs font-medium"
          style={{ background: 'rgba(0,196,154,0.15)', color: '#00C49A' }}
        >
          ROOT
        </div>

        <h2
          className="text-center text-xl font-bold text-foreground"
          style={{ fontFamily: 'var(--font-space-grotesk)' }}
        >
          {node.keyword}
        </h2>

        {node.context && (
          <p className="text-center text-xs text-muted-foreground">
            in &ldquo;{node.context}&rdquo;
          </p>
        )}

        {(isLoadingSuggestions || seedSuggestions.length > 0) && (
          <div className="mt-1 flex w-full flex-col gap-1.5 rounded-xl border border-border bg-card/70 p-2">
            {isLoadingSuggestions && (
              <div className="flex items-center gap-2 rounded-lg border border-border px-2 py-1.5 text-xs text-muted-foreground">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted-foreground/35 border-t-primary" />
                <span>{t('nodes.seedGenerating')}</span>
              </div>
            )}
            {!isLoadingSuggestions && suggestionStatus === 'fallback' && (
              <div className="rounded-lg border border-border px-2 py-1 text-[11px] text-muted-foreground">
                {t('nodes.seedFallbackNotice')}
              </div>
            )}
            {seedSuggestions.map((q, idx) => {
              const restrictToSecondSeed = isDemoMode || Boolean(introduceReveal);
              const clickable = !restrictToSecondSeed || idx === 1;
              const introSecondSeedCue =
                !!introduceReveal &&
                introduceReveal.revealedQueryIds.size === 0 &&
                idx === 1;
              return (
              <button
                key={`${node.id}-seed-${idx}`}
                type="button"
                onClick={() => {
                  if (!clickable) return;
                  if (introduceReveal) {
                    const target = sortedRootChildQueries[idx];
                    if (target) {
                      introduceReveal.revealAndRunQuery(target.id);
                      return;
                    }
                    const existing = findQueryIdByParentAndQuestion(state.nodes, node.id, q);
                    if (existing) {
                      introduceReveal.revealAndRunQuery(existing);
                      return;
                    }
                  }
                  addCustomQuery(q, node.id, node.position, undefined, 'auto', true);
                }}
                disabled={!clickable}
                className={[
                  'rounded-lg border px-2 py-1.5 text-left text-xs transition-colors',
                  clickable
                    ? [
                        'border-primary/50 text-foreground shadow-[0_0_12px_rgba(0,196,154,0.25)] hover:bg-secondary',
                        introSecondSeedCue
                          ? 'border-primary/70 bg-primary/10 shadow-[0_0_16px_rgba(0,196,154,0.35)]'
                          : '',
                      ].join(' ')
                    : 'border-border text-muted-foreground opacity-45',
                ].join(' ')}
                title="Run suggested query"
              >
                + {q}
              </button>
            );
            })}
          </div>
        )}

        {!isDemoMode && (
          <button
            onClick={() => setShowCustomInput((v) => !v)}
            className="rounded-xl px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            {t('nodes.addCustom')}
          </button>
        )}

        {!isDemoMode && showCustomInput && (
          <form onSubmit={handleSubmitCustom} className="mt-0.5 flex w-full gap-2">
            <input
              autoFocus
              value={customQ}
              onChange={(e) => setCustomQ(e.target.value)}
              placeholder={t('nodes.askPlaceholder')}
              className="flex-1 rounded-xl border border-border bg-secondary px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
            />
            <button
              type="submit"
              className="rounded-xl px-3 py-1.5 text-xs font-semibold"
              style={{ background: '#00C49A', color: '#080C12' }}
            >
              {t('nodes.add')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
