'use client';

import { useCallback, useMemo } from 'react';
import type { QueryTemplateNodeData, TemplateSlotNodeData } from '@/lib/types';
import { useWorkspace } from '@/lib/workspace-store';
import { useI18n } from '@/components/i18n-provider';
import { parseTemplateVariableKeys, substituteTemplate } from '@/lib/question-templates';

interface Props {
  node: TemplateSlotNodeData;
}

export function TemplateSlotNode({ node }: Props) {
  const { t } = useI18n();
  const { state, dispatch, runTemplateSlot, deleteTemplateSlotNode, addTemplateSlotNode } = useWorkspace();

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

  const setSlotValue = (key: string, value: string) => {
    dispatch({
      type: 'UPDATE_NODE',
      id: node.id,
      updates: { values: { ...node.values, [key]: value } } as Partial<TemplateSlotNodeData>,
    });
  };

  const splitPastedParams = (raw: string): string[] => {
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
  };

  const handleSlotPaste = useCallback(
    (targetKey: string, e: React.ClipboardEvent<HTMLInputElement>) => {
      const text = e.clipboardData.getData('text');
      const params = splitPastedParams(text);
      if (params.length === 0) return;

      // We take over paste behavior so the slot value + auto-create happen deterministically.
      e.preventDefault();
      e.stopPropagation();

      const isSingleVarTemplate = keys.length === 1;

      if (!isSingleVarTemplate) {
        // Multi-var template: only fill the targeted input with the first param.
        dispatch({
          type: 'UPDATE_NODE',
          id: node.id,
          updates: { values: { ...node.values, [targetKey]: params[0] } } as Partial<TemplateSlotNodeData>,
        });
        if (params.length === 1) window.setTimeout(() => runTemplateSlot(node.id), 0);
        return;
      }

      const mainKey = keys[0];

      // 1) Put first param into the current slot
      dispatch({
        type: 'UPDATE_NODE',
        id: node.id,
        updates: { values: { ...node.values, [mainKey]: params[0] } } as Partial<TemplateSlotNodeData>,
      });

      // 2) If multiple params, create additional slots for the rest
      if (params.length >= 2) {
        for (let i = 1; i < params.length; i++) {
          const newSlotId = addTemplateSlotNode(node.templateNodeId);
          if (!newSlotId) continue;
          dispatch({
            type: 'UPDATE_NODE',
            id: newSlotId,
            updates: { values: { [mainKey]: params[i] } } as Partial<TemplateSlotNodeData>,
          });
        }
      }

      // 3) Shortcut behavior: execute immediately for the first param
      window.setTimeout(() => runTemplateSlot(node.id), 0);
    },
    [addTemplateSlotNode, dispatch, keys, node.id, node.templateNodeId, node.values, runTemplateSlot]
  );

  if (!tpl) {
    return (
      <div
        className="flex flex-col gap-1 rounded-xl border border-destructive/40 bg-destructive/5 p-2"
        data-node-scroll="true"
        style={{ minWidth: 250, maxHeight: 260 }}
      >
        <p className="text-destructive text-xs">{t('templates.slotOrphaned')}</p>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col gap-1 rounded-xl border border-teal-500/35 bg-teal-500/[0.07] p-2"
      data-node-scroll="true"
      style={{ minWidth: 250, maxHeight: 320 }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 flex-1 truncate text-xs font-semibold text-teal-700 dark:text-teal-300">
          {tpl.templateName}
        </p>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            title={t('templates.runSlot')}
            onClick={() => runTemplateSlot(node.id)}
            className="flex h-6 w-6 items-center justify-center rounded-md bg-[#00C49A] text-[#080C12] shadow-sm transition-opacity hover:opacity-90"
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

      {keys.length === 0 ? (
        <p className="text-muted-foreground text-xs leading-snug">{substituteTemplate(tpl.pattern, {}) || '—'}</p>
      ) : (
        <div className="grid gap-1">
          {keys.map((k) => (
            <div key={k} className="flex flex-col gap-0.5">
              <input
                value={node.values[k] ?? ''}
                onChange={(e) => setSlotValue(k, e.target.value)}
                onPaste={(e) => handleSlotPaste(k, e)}
                placeholder={`{{${k}}}`}
                className="border-input bg-background rounded-md border px-2 py-1 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
