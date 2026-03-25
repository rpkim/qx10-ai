'use client';

import { useMemo } from 'react';
import type { QueryTemplateNodeData, TemplateSlotNodeData } from '@/lib/types';
import { useWorkspace } from '@/lib/workspace-store';
import { useI18n } from '@/components/i18n-provider';
import { parseTemplateVariableKeys, substituteTemplate } from '@/lib/question-templates';

interface Props {
  node: TemplateSlotNodeData;
}

export function TemplateSlotNode({ node }: Props) {
  const { t } = useI18n();
  const { state, dispatch, runTemplateSlot, deleteTemplateSlotNode } = useWorkspace();

  const tpl = useMemo(
    () =>
      state.nodes.find(
        (n): n is QueryTemplateNodeData =>
          n.id === node.templateNodeId && n.type === 'query-template'
      ) ?? null,
    [state.nodes, node.templateNodeId]
  );

  const keys = useMemo(
    () => (tpl ? parseTemplateVariableKeys(tpl.pattern) : []),
    [tpl]
  );

  const slotIndex = useMemo(() => {
    const peers = state.nodes
      .filter(
        (n): n is TemplateSlotNodeData =>
          n.type === 'template-slot' && n.templateNodeId === node.templateNodeId
      )
      .sort((a, b) => a.position.x - b.position.x || a.id.localeCompare(b.id));
    const i = peers.findIndex((n) => n.id === node.id);
    return i >= 0 ? i : 0;
  }, [state.nodes, node.templateNodeId, node.id]);

  const setSlotValue = (key: string, value: string) => {
    dispatch({
      type: 'UPDATE_NODE',
      id: node.id,
      updates: { values: { ...node.values, [key]: value } } as Partial<TemplateSlotNodeData>,
    });
  };

  if (!tpl) {
    return (
      <div
        className="flex flex-col gap-2 rounded-2xl border border-destructive/40 bg-destructive/5 p-3"
        data-node-scroll="true"
        style={{ minWidth: 280, maxHeight: 320 }}
      >
        <p className="text-destructive text-xs">{t('templates.slotOrphaned')}</p>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col gap-2 rounded-2xl border border-teal-500/35 bg-teal-500/[0.07] p-3"
      data-node-scroll="true"
      style={{ minWidth: 280, maxHeight: 420 }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-teal-600/90 dark:text-teal-400/90">
            {t('templates.slotNodeBadge')}
          </p>
          <p className="text-muted-foreground mt-0.5 text-[11px] font-medium leading-snug">
            → {tpl.templateName}
          </p>
          <p className="text-muted-foreground mt-1 line-clamp-2 font-mono text-[10px] leading-relaxed">
            {tpl.pattern}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            title={t('templates.runSlot')}
            onClick={() => runTemplateSlot(node.id)}
            className="flex h-7 w-7 items-center justify-center rounded-md bg-[#00C49A] text-[#080C12] shadow-sm transition-opacity hover:opacity-90"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          </button>
          <button
            type="button"
            title={t('templates.removeSlot')}
            onClick={() => deleteTemplateSlotNode(node.id)}
            className="text-muted-foreground hover:text-destructive px-1 text-xs"
          >
            ×
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between border-border/60 border-b pb-1">
        <span className="text-muted-foreground text-[10px] font-medium">
          {t('templates.slotLabel', { n: slotIndex + 1 })}
        </span>
      </div>

      {keys.length === 0 ? (
        <p className="text-muted-foreground text-[11px]">
          {substituteTemplate(tpl.pattern, {}) || '—'}
        </p>
      ) : (
        <div className="grid gap-1.5">
          {keys.map((k) => (
            <div key={k} className="flex flex-col gap-0.5">
              <label className="text-muted-foreground font-mono text-[9px]">{`{{${k}}}`}</label>
              <input
                value={node.values[k] ?? ''}
                onChange={(e) => setSlotValue(k, e.target.value)}
                className="border-input bg-background rounded-md border px-2 py-1 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          ))}
        </div>
      )}

      <div className="border-border border-t pt-1">
        <span className="text-muted-foreground text-[9px] uppercase">{t('templates.preview')}</span>
        <p className="text-foreground mt-0.5 text-[11px] leading-snug">
          {substituteTemplate(tpl.pattern, node.values)}
        </p>
      </div>
    </div>
  );
}
