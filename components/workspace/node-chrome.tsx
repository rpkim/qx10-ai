'use client';

import { useState, useMemo } from 'react';
import { useWorkspace } from '@/lib/workspace-store';
import { useI18n } from '@/components/i18n-provider';
import type { WorkspaceNode } from '@/lib/types';
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
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react';

function countSubtreeSize(rootId: string, nodes: WorkspaceNode[]): number {
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

  const subtreeCount = useMemo(
    () => (deleteOpen ? countSubtreeSize(node.id, state.nodes) : 0),
    [deleteOpen, node.id, state.nodes]
  );

  const nodesCountPhrase =
    subtreeCount > 1 ? t('nodeChrome.deleteBranchNodesCount', { count: subtreeCount }) : '';

  return (
    <>
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
        <button
          type="button"
          title="이 가지 삭제"
          onClick={() => setDeleteOpen(true)}
          className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-card/95 text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="size-3" />
        </button>
      </div>

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
