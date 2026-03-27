'use client';

import { useEffect, useState } from 'react';
import type { RootNodeData } from '@/lib/types';
import { useWorkspace } from '@/lib/workspace-store';
import { useI18n } from '@/components/i18n-provider';
import { getSuggestedQueries } from '@/lib/mock-data';

interface Props {
  node: RootNodeData;
}

export function RootNode({ node }: Props) {
  const { t } = useI18n();
  const { addCustomQuery } = useWorkspace();
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customQ, setCustomQ] = useState('');
  const [seedSuggestions, setSeedSuggestions] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/workspace/seed-queries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword: node.keyword, goal: node.goal }),
    })
      .then((r) => r.json())
      .then((data: { questions?: string[] }) => {
        if (cancelled) return;
        const qs = Array.isArray(data.questions)
          ? data.questions.map((q) => String(q).trim()).filter(Boolean)
          : [];
        setSeedSuggestions(qs.length > 0 ? qs.slice(0, 6) : getSuggestedQueries(node.keyword).slice(0, 6));
      })
      .catch(() => {
        if (!cancelled) {
          setSeedSuggestions(getSuggestedQueries(node.keyword).slice(0, 6));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [node.keyword, node.goal]);

  const handleSubmitCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const q = customQ.trim();
    if (!q) return;
    addCustomQuery(q, node.id, node.position, undefined, 'auto', true);
    setCustomQ('');
    setShowCustomInput(false);
  };

  return (
    <div
      className="relative flex flex-col items-center justify-center rounded-2xl border px-6 py-4"
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
          className="flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium"
          style={{ background: 'rgba(0,196,154,0.15)', color: '#00C49A' }}
        >
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: '#00C49A' }}
          />
          {node.goal.toUpperCase()}
        </div>

        <h2
          className="text-center text-xl font-bold text-foreground"
          style={{ fontFamily: 'var(--font-space-grotesk)' }}
        >
          {node.keyword}
        </h2>

        {seedSuggestions.length > 0 && (
          <div className="mt-1 flex w-full flex-col gap-1.5 rounded-xl border border-border bg-card/70 p-2">
            {seedSuggestions.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => addCustomQuery(q, node.id, node.position, undefined, 'auto', true)}
                className="rounded-lg border border-border px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                title="Run suggested query"
              >
                + {q}
              </button>
            ))}
          </div>
        )}

        <button
          onClick={() => setShowCustomInput((v) => !v)}
          className="rounded-xl px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          {t('nodes.addCustom')}
        </button>

        {showCustomInput && (
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
