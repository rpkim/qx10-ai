'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { QueryTemplateNodeData, TemplateSlotNodeData } from '@/lib/types';
import { useWorkspace } from '@/lib/workspace-store';
import { useI18n } from '@/components/i18n-provider';
import { parseTemplateVariableKeys } from '@/lib/question-templates';
import { toast } from 'sonner';
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
  const { state, dispatch, aiCatalog, addTemplateSlotNode, runTemplateSlot } = useWorkspace();

  const keys = useMemo(() => parseTemplateVariableKeys(node.pattern), [node.pattern]);
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeIdRef = useRef(node.id);
  useEffect(() => {
    nodeIdRef.current = node.id;
  }, [node.id]);

  const splitPastedParams = useCallback((raw: string): string[] => {
    const cleaned = raw.replace(/\r/g, '\n').trim();
    if (!cleaned) return [];

    const byLine = cleaned
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (byLine.length >= 2) return byLine;

    // Fallback for single-line pasted data.
    return cleaned
      .split(/[,\t]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }, []);

  const handleTemplatePaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      const text = e.clipboardData.getData('text');
      const params = splitPastedParams(text);
      if (params.length === 0) return;

      // Shortcut behavior is only implemented for single-var templates.
      if (keys.length !== 1) return;

      e.preventDefault();
      e.stopPropagation();

      const mainKey = keys[0];

      // Important: when a slot already exists, keep it and append new slots.
      const createdSlotIds: string[] = [];
      for (let i = 0; i < params.length; i++) {
        const newSlotId = addTemplateSlotNode(node.id);
        if (!newSlotId) continue;
        createdSlotIds.push(newSlotId);
        dispatch({
          type: 'UPDATE_NODE',
          id: newSlotId,
          updates: { values: { [mainKey]: params[i] } } as any,
        });
      }

      const firstNewSlotId = createdSlotIds[0];
      if (!firstNewSlotId) return;

      window.setTimeout(() => runTemplateSlot(firstNewSlotId), 0);
    },
    [addTemplateSlotNode, dispatch, keys, node.id, runTemplateSlot, splitPastedParams, state.nodes]
  );

  // More reliable for "paste onto card" (focus is sometimes hijacked by canvas drag logic).
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const activeId = (window as any).__qx10ActiveTemplatePasteId as string | undefined;
      if (!activeId || activeId !== nodeIdRef.current) return;

      const target = e.target as HTMLElement | null;
      const inTextField =
        !!target?.closest?.('input,textarea,[contenteditable="true"],[contenteditable="plaintext-only"]');
      if (inTextField) return; // normal paste to inputs

      const text = e.clipboardData?.getData('text') ?? '';
      const params = splitPastedParams(text);
      if (params.length === 0) return;

      if (keys.length !== 1) {
        toast.error(t('templates.slotFillRequired'));
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const mainKey = keys[0];
      // Important: keep existing slots and append new ones.
      const createdSlotIds: string[] = [];
      for (let i = 0; i < params.length; i++) {
        const newSlotId = addTemplateSlotNode(node.id);
        if (!newSlotId) continue;
        createdSlotIds.push(newSlotId);
        dispatch({
          type: 'UPDATE_NODE',
          id: newSlotId,
          updates: { values: { [mainKey]: params[i] } } as any,
        });
      }

      const firstNewSlotId = createdSlotIds[0];
      if (!firstNewSlotId) return;

      window.setTimeout(() => runTemplateSlot(firstNewSlotId), 0);
    };

    window.addEventListener('paste', onPaste, true);
    return () => window.removeEventListener('paste', onPaste, true);
  }, [addTemplateSlotNode, dispatch, keys, node.id, runTemplateSlot, splitPastedParams, state.nodes, t]);

  const effectiveModelId =
    node.modelChoice ??
    aiCatalog?.defaultChoice ??
    aiCatalog?.options[0]?.id ??
    '';

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onFocus={() => {
        (window as any).__qx10ActiveTemplatePasteId = node.id;
      }}
      onPointerDown={() => {
        (window as any).__qx10ActiveTemplatePasteId = node.id;
      }}
      onMouseDown={() => {
        // Make sure Cmd/Ctrl+V lands on this template card even if no input is focused.
        containerRef.current?.focus();
        (window as any).__qx10ActiveTemplatePasteId = node.id;
      }}
      onPaste={handleTemplatePaste}
      className="flex flex-col gap-2 rounded-2xl border border-amber-500/35 bg-amber-500/6 p-3"
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
          onClick={() => void addTemplateSlotNode(node.id)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-500/40 bg-amber-500/15 text-lg font-semibold text-amber-700 transition-colors hover:bg-amber-500/25 dark:text-amber-300"
        >
          +
        </button>
      </div>

      <p className="text-muted-foreground text-center text-[11px] leading-snug">
        {t('templates.addSlotHint')}
      </p>

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

      {keys.length > 0 && (
        <div className="flex flex-col gap-1 border-border/50 border-t pt-2">
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {t('templates.detectedVars')}
          </span>
          <div className="flex flex-wrap gap-1">
            {keys.map((k) => (
              <span
                key={k}
                className="rounded-md bg-secondary px-2 py-0.5 font-mono text-[10px]"
              >{`{{${k}}}`}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
