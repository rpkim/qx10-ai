'use client';

import { useCallback, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useWorkspace } from '@/lib/workspace-store';
import { useI18n } from '@/components/i18n-provider';
import { searchWorkspaceNodeIds } from '@/lib/workspace-node-search';
import { getNodeWorldCenter } from '@/lib/workspace-node-bounds';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const CANVAS_ID = 'workspace-canvas';

export function WorkspaceNodeSearchBar() {
  const { t } = useI18n();
  const { state, dispatch } = useWorkspace();
  const { nodes, viewport } = state;
  const [q, setQ] = useState('');
  const [matches, setMatches] = useState<string[]>([]);
  const [matchIndex, setMatchIndex] = useState(0);

  const focusNode = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) {
        toast.error(t('toolbar.nodeSearchNoResults'));
        return;
      }
      dispatch({ type: 'EXPAND_TO_SHOW_NODE', nodeId });
      dispatch({ type: 'SET_SELECTED_NODES', ids: [nodeId] });

      const canvasEl = typeof document !== 'undefined' ? document.getElementById(CANVAS_ID) : null;
      const rect = canvasEl?.getBoundingClientRect();
      const w = rect?.width ?? (typeof window !== 'undefined' ? window.innerWidth : 800);
      const h = rect?.height ?? (typeof window !== 'undefined' ? window.innerHeight : 600);
      const { cx, cy } = getNodeWorldCenter(node);
      const z = viewport.zoom;
      dispatch({
        type: 'SET_VIEWPORT',
        viewport: {
          x: w / 2 - cx * z,
          y: h / 2 - cy * z,
          zoom: z,
        },
      });
    },
    [dispatch, nodes, viewport.zoom, t]
  );

  const runSearch = useCallback(() => {
    const list = searchWorkspaceNodeIds(nodes, q);
    setMatches(list);
    setMatchIndex(0);
    if (list.length === 0) {
      toast.message(t('toolbar.nodeSearchNoResults'));
      return;
    }
    focusNode(list[0]);
  }, [nodes, q, focusNode, t]);

  const goNext = useCallback(() => {
    if (matches.length === 0) {
      runSearch();
      return;
    }
    const next = (matchIndex + 1) % matches.length;
    setMatchIndex(next);
    focusNode(matches[next]);
  }, [matches, matchIndex, focusNode, runSearch]);

  const showNext = matches.length > 1;

  const hint = useMemo(() => {
    if (matches.length <= 1) return null;
    return t('toolbar.nodeSearchMatchCount', {
      current: matchIndex + 1,
      total: matches.length,
    });
  }, [matches.length, matchIndex, t]);

  return (
    <div className="flex w-full min-w-0 flex-col gap-1">
      <div className="flex min-w-0 items-center gap-1.5">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('toolbar.nodeSearchPlaceholder')}
          className="h-8 min-w-0 flex-1 text-xs"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              runSearch();
            }
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-8 shrink-0 px-2"
          title={t('toolbar.nodeSearch')}
          onClick={runSearch}
        >
          <Search className="size-3.5" />
        </Button>
        {showNext && (
          <Button type="button" size="sm" variant="outline" className="h-8 shrink-0 px-2 text-xs" onClick={goNext}>
            {t('toolbar.nodeSearchNext')}
          </Button>
        )}
      </div>
      {hint && <span className="text-muted-foreground px-0.5 text-[10px]">{hint}</span>}
    </div>
  );
}
