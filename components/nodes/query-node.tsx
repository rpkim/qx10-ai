'use client';

import { useState } from 'react';
import type { QueryNodeData } from '@/lib/types';
import { useWorkspace } from '@/lib/workspace-store';
import { useI18n } from '@/components/i18n-provider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Props {
  node: QueryNodeData;
}

const STATUS_COLORS = {
  suggested: { border: 'rgba(96,165,250,0.3)', bg: 'rgba(96,165,250,0.04)', dot: '#60A5FA' },
  idle: { border: 'rgba(96,165,250,0.3)', bg: 'rgba(96,165,250,0.04)', dot: '#60A5FA' },
  running: { border: 'rgba(0,196,154,0.5)', bg: 'rgba(0,196,154,0.06)', dot: '#00C49A' },
  streaming: { border: 'rgba(0,196,154,0.5)', bg: 'rgba(0,196,154,0.06)', dot: '#00C49A' },
  complete: { border: 'rgba(96,165,250,0.4)', bg: 'rgba(96,165,250,0.06)', dot: '#60A5FA' },
  error: { border: 'rgba(239,68,68,0.4)', bg: 'rgba(239,68,68,0.04)', dot: '#EF4444' },
};

export function QueryNode({ node }: Props) {
  const { t } = useI18n();
  const { runQuery, addCustomQuery, dispatch, aiCatalog } = useWorkspace();
  const [showCustom, setShowCustom] = useState(false);
  const [customQ, setCustomQ] = useState('');
  const colors = STATUS_COLORS[node.status] ?? STATUS_COLORS.suggested;
  const isRunning = node.status === 'running';
  const isComplete = node.status === 'complete';

  const effectiveModelId =
    node.modelChoice ??
    aiCatalog?.defaultChoice ??
    aiCatalog?.options[0]?.id ??
    '';
  const modelLabel =
    aiCatalog?.options.find((o) => o.id === effectiveModelId)?.label ?? effectiveModelId;
  const effectiveTool = node.toolChoice ?? 'auto';

  const handleRun = () => {
    if (!isRunning && !isComplete) {
      runQuery(node.id);
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customQ.trim()) {
      addCustomQuery(
        customQ.trim(),
        node.id,
        node.position,
        node.modelChoice ?? aiCatalog?.defaultChoice,
        node.toolChoice ?? 'auto'
      );
      setCustomQ('');
      setShowCustom(false);
    }
  };

  return (
    <div
      className="flex flex-col gap-2 rounded-2xl border p-4 transition-all duration-300"
      style={{
        borderColor: colors.border,
        background: colors.bg,
        boxShadow: isRunning
          ? '0 0 16px rgba(0,196,154,0.2), 0 4px 12px rgba(0,0,0,0.3)'
          : '0 4px 12px rgba(0,0,0,0.25)',
        backdropFilter: 'blur(8px)',
        minWidth: 280,
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold"
            style={{ background: colors.dot, color: '#080C12' }}
          >
            Q
          </span>
          {node.isCustom && (
            <span
              className="rounded-full px-2 py-0.5 text-xs"
              style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}
            >
              {t('nodes.customBadge')}
            </span>
          )}
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-1.5">
          {isRunning ? (
            <span className="flex items-center gap-1 text-xs" style={{ color: '#00C49A' }}>
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: '#00C49A', animation: 'ping-dot 1s cubic-bezier(0,0,0.2,1) infinite' }}
              />
              {t('nodes.running')}
            </span>
          ) : isComplete ? (
            <span className="text-xs text-muted-foreground">{t('nodes.done')}</span>
          ) : (
            <span className="text-xs text-muted-foreground">{t('nodes.suggested')}</span>
          )}
        </div>
      </div>

      {/* Question */}
      <p className="text-sm leading-relaxed text-foreground">{node.question}</p>

      {/* Model (env-driven catalog) */}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {t('nodes.model')}
        </span>
        {!aiCatalog ? (
          <span className="text-xs text-muted-foreground">{t('nodes.loadingModels')}</span>
        ) : aiCatalog.options.length === 0 ? (
          <span className="text-xs text-muted-foreground">{t('nodes.demoModelsHint')}</span>
        ) : aiCatalog.options.length === 1 ? (
          <span className="text-xs text-foreground/80">{aiCatalog.options[0].label}</span>
        ) : isComplete || isRunning ? (
          <span className="text-xs text-foreground/80">{modelLabel || t('nodes.defaultModel')}</span>
        ) : (
          <Select
            value={effectiveModelId}
            onValueChange={(id) =>
              dispatch({
                type: 'UPDATE_NODE',
                id: node.id,
                updates: { modelChoice: id },
              })
            }
          >
            <SelectTrigger size="sm" className="h-8 w-full max-w-full text-xs">
              <SelectValue placeholder={t('nodes.selectModel')} />
            </SelectTrigger>
            <SelectContent>
              {aiCatalog.options.map((opt) => (
                <SelectItem key={opt.id} value={opt.id} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Tool routing */}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Tool
        </span>
        {isComplete || isRunning ? (
          <span className="text-xs text-foreground/80">
            {effectiveTool === 'market'
              ? 'Stock'
              : effectiveTool === 'web'
                ? 'Web Search'
                : 'Auto'}
          </span>
        ) : (
          <Select
            value={effectiveTool}
            onValueChange={(id) =>
              dispatch({
                type: 'UPDATE_NODE',
                id: node.id,
                updates: { toolChoice: id as 'auto' | 'web' | 'market' },
              })
            }
          >
            <SelectTrigger size="sm" className="h-8 w-full max-w-full text-xs">
              <SelectValue placeholder="Select tool" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto" className="text-xs">Auto</SelectItem>
              <SelectItem value="web" className="text-xs">Web Search</SelectItem>
              <SelectItem value="market" className="text-xs">Stock</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Actions */}
      {!isComplete && !isRunning && (
        <div className="flex gap-2">
          <button
            onClick={handleRun}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-all"
            style={{ background: 'rgba(0,196,154,0.15)', color: '#00C49A' }}
            onMouseOver={(e) =>
              Object.assign((e.currentTarget as HTMLElement).style, {
                background: 'rgba(0,196,154,0.25)',
                boxShadow: '0 0 8px rgba(0,196,154,0.2)',
              })
            }
            onMouseOut={(e) =>
              Object.assign((e.currentTarget as HTMLElement).style, {
                background: 'rgba(0,196,154,0.15)',
                boxShadow: 'none',
              })
            }
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5,3 19,12 5,21" />
            </svg>
            {t('nodes.run')}
          </button>
          <button
            onClick={() => setShowCustom(!showCustom)}
            className="rounded-xl px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            {t('nodes.addCustom')}
          </button>
        </div>
      )}

      {showCustom && (
        <form onSubmit={handleCustomSubmit} className="flex gap-2">
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

      {isRunning && (
        <div className="h-0.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full"
            style={{
              background: '#00C49A',
              animation: 'loading-bar 1.2s ease-in-out infinite',
              width: '40%',
            }}
          />
        </div>
      )}

    </div>
  );
}
