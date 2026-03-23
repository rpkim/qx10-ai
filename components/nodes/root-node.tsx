'use client';

import { useState } from 'react';
import type { RootNodeData } from '@/lib/types';
import { useWorkspace } from '@/lib/workspace-store';
import { useI18n } from '@/components/i18n-provider';

interface Props {
  node: RootNodeData;
}

export function RootNode({ node }: Props) {
  const { t } = useI18n();
  const { state, runQuery, addCustomQuery } = useWorkspace();
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customQ, setCustomQ] = useState('');

  const handleAddAllQueries = () => {
    // All suggested queries are already in the initial workspace, just mark them as run
    const childQueries = state.nodes.filter(
      (n) => n.type === 'query' && n.parentId === 'root'
    );
    childQueries.forEach((q) => {
      if (q.status === 'suggested') {
        runQuery(q.id);
      }
    });
  };

  const handleSubmitCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const q = customQ.trim();
    if (!q) return;
    addCustomQuery(q, node.id, node.position);
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

        <button
          onClick={handleAddAllQueries}
          className="mt-1 rounded-xl px-4 py-1.5 text-xs font-medium transition-all hover:shadow-[0_0_8px_rgba(0,196,154,0.3)]"
          style={{ background: 'rgba(0,196,154,0.15)', color: '#00C49A' }}
        >
          Explore all queries
        </button>

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
