'use client';

import { useMemo } from 'react';
import type { QueryTemplateNodeData } from '@/lib/types';
import { useWorkspace } from '@/lib/workspace-store';
import { useI18n } from '@/components/i18n-provider';
import { parseTemplateVariableKeys } from '@/lib/question-templates';
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
  const { dispatch, aiCatalog, addTemplateSlotNode } = useWorkspace();

  const keys = useMemo(() => parseTemplateVariableKeys(node.pattern), [node.pattern]);

  const effectiveModelId =
    node.modelChoice ??
    aiCatalog?.defaultChoice ??
    aiCatalog?.options[0]?.id ??
    '';
  const effectiveTool = node.toolChoice ?? 'auto';

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
          onClick={() => addTemplateSlotNode(node.id)}
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
