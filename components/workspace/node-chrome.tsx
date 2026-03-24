'use client';

import { useState, useMemo } from 'react';
import { useWorkspace } from '@/lib/workspace-store';
import { useI18n } from '@/components/i18n-provider';
import type { QueryNodeData, QueryToolChoice, WorkspaceNode } from '@/lib/types';
import { QuestionTemplateDesignerDialog } from '@/components/question-template-designer-dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ChevronDown, ChevronRight, LayoutTemplate, Trash2 } from 'lucide-react';

function countSubtreeSize(
  rootId: string,
  nodes: WorkspaceNode[]
): number {
  const collect = (id: string): string[] => {
    const children = nodes.filter((n) => n.parentId === id).map((n) => n.id);
    return [id, ...children.flatMap(collect)];
  };
  return collect(rootId).length;
}

interface Props {
  node: WorkspaceNode;
  hasChildren: boolean;
  isCollapsed: boolean;
}

export function NodeChrome({ node, hasChildren, isCollapsed }: Props) {
  const { t } = useI18n();
  const { state, dispatch, deleteNode } = useWorkspace();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [templateDesignerOpen, setTemplateDesignerOpen] = useState(false);
  const isQuery = node.type === 'query';

  const templateDialogSeed = useMemo(() => {
    if (node.type !== 'query') {
      return {
        initialFollowUpQuestions: [] as string[],
        initialToolChoice: 'auto' as const,
      };
    }
    const q = node as QueryNodeData;
    const ansEdge = state.edges.find((e) => e.sourceId === q.id);
    const answer = ansEdge
      ? state.nodes.find((n) => n.id === ansEdge.targetId)
      : undefined;
    const fromSuggested =
      answer?.type === 'answer'
        ? (answer.suggestedQueries ?? []).map((s) => s.trim()).filter(Boolean)
        : [];
    const fromChildren =
      answer?.type === 'answer'
        ? state.nodes
            .filter(
              (n): n is QueryNodeData =>
                n.type === 'query' && n.parentId === answer.id
            )
            .map((n) => n.question.trim())
            .filter(Boolean)
        : [];
    const seen = new Set<string>();
    const followUps: string[] = [];
    for (const line of [...fromSuggested, ...fromChildren]) {
      if (!line || seen.has(line)) continue;
      seen.add(line);
      followUps.push(line);
    }
    return {
      initialFollowUpQuestions: followUps,
      initialToolChoice: (q.toolChoice ?? 'auto') as QueryToolChoice,
    };
  }, [node, state.nodes, state.edges]);

  const subtreeCount = useMemo(
    () => (deleteOpen ? countSubtreeSize(node.id, state.nodes) : 0),
    [deleteOpen, node.id, state.nodes]
  );

  const nodesCountPhrase =
    subtreeCount > 1 ? t('nodeChrome.deleteBranchNodesCount', { count: subtreeCount }) : '';

  return (
    <>
      {/* Toolbar height must match NODE_CANVAS_TOOLBAR_HEIGHT_PX (lib/canvas-node-chrome.ts) */}
      <div
        className="pointer-events-auto mb-1 flex w-full shrink-0 items-center justify-end gap-0.5"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {hasChildren && (
          <button
            type="button"
            title={isCollapsed ? t('nodeChrome.expandBranch') : t('nodeChrome.collapseBranch')}
            aria-expanded={!isCollapsed}
            onClick={() =>
              dispatch({ type: 'TOGGLE_COLLAPSE_BRANCH', nodeId: node.id })
            }
            className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-card/95 text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:border-primary/50 hover:bg-secondary hover:text-foreground"
          >
            {isCollapsed ? (
              <ChevronRight className="size-3.5" />
            ) : (
              <ChevronDown className="size-3.5" />
            )}
          </button>
        )}
        {isQuery && (
          <button
            type="button"
            title={t('templates.registerMenu')}
            onClick={() => setTemplateDesignerOpen(true)}
            className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-card/95 text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400"
          >
            <LayoutTemplate className="size-3.5" />
          </button>
        )}
        <button
          type="button"
          title="이 가지 삭제"
          onClick={() => setDeleteOpen(true)}
          className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-card/95 text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="size-3" />
        </button>
      </div>

      {isQuery && (
        <QuestionTemplateDesignerDialog
          open={templateDesignerOpen}
          onOpenChange={setTemplateDesignerOpen}
          initialPattern={(node as QueryNodeData).question}
          initialName={(node as QueryNodeData).question.slice(0, 64).trim()}
          initialToolChoice={templateDialogSeed.initialToolChoice}
          initialFollowUpQuestions={templateDialogSeed.initialFollowUpQuestions}
          templateId={null}
        />
      )}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="border-border sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('nodeChrome.deleteBranchTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('nodeChrome.deleteBranchDesc', { nodes: nodesCountPhrase })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                deleteNode(node.id);
                setDeleteOpen(false);
              }}
            >
              {t('nodeChrome.deleteConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
