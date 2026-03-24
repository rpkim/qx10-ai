'use client';

import { useMemo } from 'react';
import type { QueryTemplateNodeData } from '@/lib/types';
import { useWorkspace } from '@/lib/workspace-store';
import { useI18n } from '@/components/i18n-provider';
import { parseTemplateVariableKeys, substituteTemplate } from '@/lib/question-templates';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Props {
  node: QueryTemplateNodeData;
}

export function QueryTemplateNode({ node }: Props) {
  const { t } = useI18n();
  const { dispatch, aiCatalog, runTemplateSlot } = useWorkspace();

  const keys = useMemo(() => parseTemplateVariableKeys(node.pattern), [node.pattern]);

  const effectiveModelId =
    node.modelChoice ??
    aiCatalog?.defaultChoice ??
    aiCatalog?.options[0]?.id ??
    '';
  const effectiveTool = node.toolChoice ?? 'auto';

  const addSlot = () => {
    const emptyValues =
      keys.length > 0
        ? Object.fromEntries(keys.map((k) => [k, ''])) as Record<string, string>
        : {};
    const nextSlots = [
      ...node.slots,
      { id: `slot-${Date.now()}`, values: emptyValues },
    ];
    const nextH = 96 + Math.min(nextSlots.length, 8) * 56 + (nextSlots.length > 8 ? 40 : 0);
    dispatch({
      type: 'UPDATE_NODE',
      id: node.id,
      updates: {
        slots: nextSlots,
        height: Math.max(160, nextH),
      } as Partial<QueryTemplateNodeData>,
    });
  };

  const setSlotValue = (slotId: string, key: string, value: string) => {
    const nextSlots = node.slots.map((s) =>
      s.id === slotId ? { ...s, values: { ...s.values, [key]: value } } : s
    );
    dispatch({
      type: 'UPDATE_NODE',
      id: node.id,
      updates: { slots: nextSlots } as Partial<QueryTemplateNodeData>,
    });
  };

  const removeSlot = (slotId: string) => {
    const victim = node.slots.find((s) => s.id === slotId);
    if (victim?.linkedQueryId) {
      dispatch({ type: 'DELETE_NODE', id: victim.linkedQueryId });
    }
    const nextSlots = node.slots.filter((s) => s.id !== slotId);
    const nextH = 96 + Math.min(Math.max(nextSlots.length, 1), 8) * 56;
    dispatch({
      type: 'UPDATE_NODE',
      id: node.id,
      updates: {
        slots: nextSlots,
        height: Math.max(160, nextH),
      } as Partial<QueryTemplateNodeData>,
    });
  };

  return (
    <div
      className="flex flex-col gap-2 rounded-2xl border border-amber-500/35 bg-amber-500/[0.06] p-3"
      data-node-scroll="true"
      style={{ minWidth: 280, maxHeight: 420 }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-600/90 dark:text-amber-400/90">
            {t('templates.templateNodeBadge')}
          </p>
          <p className="text-sm font-medium leading-snug text-foreground">{node.templateName}</p>
          <p className="text-muted-foreground mt-1 line-clamp-3 font-mono text-[11px] leading-relaxed">
            {node.pattern}
          </p>
        </div>
        <button
          type="button"
          title={t('templates.addSlotTooltip')}
          onClick={addSlot}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-500/40 bg-amber-500/15 text-lg font-semibold text-amber-700 transition-colors hover:bg-amber-500/25 dark:text-amber-300"
        >
          +
        </button>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {t('nodes.model')}
        </span>
        {!aiCatalog ? (
          <span className="text-xs text-muted-foreground">{t('nodes.loadingModels')}</span>
        ) : aiCatalog.options.length <= 1 ? (
          <span className="text-xs text-foreground/80">
            {aiCatalog.options[0]?.label ?? effectiveModelId}
          </span>
        ) : (
          <Select
            value={effectiveModelId}
            onValueChange={(id) =>
              dispatch({
                type: 'UPDATE_NODE',
                id: node.id,
                updates: { modelChoice: id } as Partial<QueryTemplateNodeData>,
              })
            }
          >
            <SelectTrigger size="sm" className="h-8 w-full text-xs">
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

      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Tool
        </span>
        <Select
          value={effectiveTool}
          onValueChange={(id) =>
            dispatch({
              type: 'UPDATE_NODE',
              id: node.id,
              updates: { toolChoice: id as 'auto' | 'web' | 'market' } as Partial<QueryTemplateNodeData>,
            })
          }
        >
          <SelectTrigger size="sm" className="h-8 w-full text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto" className="text-xs">
              Auto
            </SelectItem>
            <SelectItem value="web" className="text-xs">
              Web Search
            </SelectItem>
            <SelectItem value="market" className="text-xs">
              Stock
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-0.5">
        {node.slots.length === 0 ? (
          <p className="text-muted-foreground text-center text-xs">{t('templates.addSlotHint')}</p>
        ) : (
          node.slots.map((slot, idx) => (
            <div
              key={slot.id}
              className="border-border space-y-2 rounded-lg border bg-background/40 p-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground text-[10px] font-medium">
                  {t('templates.slotLabel', { n: idx + 1 })}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    title={t('templates.runSlot')}
                    onClick={() => runTemplateSlot(node.id, slot.id)}
                    className="flex h-7 w-7 items-center justify-center rounded-md bg-[#00C49A] text-[#080C12] shadow-sm transition-opacity hover:opacity-90"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="5,3 19,12 5,21" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    title={t('templates.removeSlot')}
                    onClick={() => removeSlot(slot.id)}
                    className="text-muted-foreground hover:text-destructive px-1 text-xs"
                  >
                    ×
                  </button>
                </div>
              </div>
              {keys.length === 0 ? (
                <p className="text-muted-foreground text-[11px]">
                  {substituteTemplate(node.pattern, {}) || '—'}
                </p>
              ) : (
                <div className="grid gap-1.5">
                  {keys.map((k) => (
                    <div key={k} className="flex flex-col gap-0.5">
                      <label className="text-muted-foreground font-mono text-[9px]">{`{{${k}}}`}</label>
                      <input
                        value={slot.values[k] ?? ''}
                        onChange={(e) => setSlotValue(slot.id, k, e.target.value)}
                        className="border-input bg-background rounded-md border px-2 py-1 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                    </div>
                  ))}
                </div>
              )}
              <div className="border-border border-t pt-1">
                <span className="text-muted-foreground text-[9px] uppercase">
                  {t('templates.preview')}
                </span>
                <p className="text-foreground mt-0.5 text-[11px] leading-snug">
                  {substituteTemplate(node.pattern, slot.values)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
