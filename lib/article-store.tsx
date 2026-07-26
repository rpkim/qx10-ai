'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import { toast } from 'sonner';
import { useI18n } from '@/components/i18n-provider';
import { useWorkspace } from '@/lib/workspace-store';
import { consumeWorkspaceQueryStream } from '@/lib/ai/consume-query-stream';
import { GEMINI_BYOK_HEADER, loadGeminiApiKey } from '@/lib/byok/gemini-key-vault';
import {
  getArticleQuickAction,
  type ArticleDraft,
  type ArticleQuickActionId,
} from '@/lib/ai/article-prompts';
import {
  buildArticleFileMarkdown,
  collectQaSources,
  dataNodeToMarkdown,
  parseSeedDraft,
} from '@/lib/article-markdown';
import {
  loadArticleDraft,
  saveArticleDraft,
  type StoredArticleMessage,
  type StoredArticleDraft,
} from '@/lib/article-draft-storage';
import {
  fetchArticleDraftFromServer,
  saveArticleDraftToServer,
} from '@/lib/workspace-api';

export type ArticleEditorMode = 'edit' | 'preview';
export type ArticleInsertTarget = 'cursor' | 'end' | 'replace';

export interface ArticleMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
  failed?: boolean;
}

interface ArticleState {
  draft: ArticleDraft;
  mode: ArticleEditorMode;
  messages: ArticleMessage[];
  seeding: boolean;
  chatting: boolean;
  aiUnavailable: boolean;
  /** Current textarea selection, kept in sync by the editor pane. */
  selection: { start: number; end: number };
  /** Bumped after a programmatic body change so the editor can restore the caret. */
  caretRequest: { position: number; nonce: number };
  hydrated: boolean;
}

type Action =
  | { type: 'HYDRATE'; draft: ArticleDraft; messages: ArticleMessage[] }
  | { type: 'SET_TITLE'; value: string }
  | { type: 'SET_SUBTITLE'; value: string }
  | { type: 'SET_BODY'; value: string }
  | { type: 'SET_BODY_WITH_CARET'; value: string; caret: number }
  | { type: 'SET_MODE'; mode: ArticleEditorMode }
  | { type: 'SET_SELECTION'; start: number; end: number }
  | { type: 'SEED_START' }
  | { type: 'SEED_TOKEN'; text: string }
  | { type: 'SEED_DONE'; draft: ArticleDraft }
  | { type: 'SEED_FAILED' }
  | { type: 'ADD_MESSAGE'; message: ArticleMessage }
  | { type: 'APPEND_TOKEN'; id: string; text: string }
  | { type: 'FINISH_MESSAGE'; id: string; failed?: boolean; content?: string }
  | { type: 'CHAT_START' }
  | { type: 'CHAT_END' }
  | { type: 'CLEAR_CHAT' }
  | { type: 'SET_AI_UNAVAILABLE'; value: boolean };

const initialState: ArticleState = {
  draft: { title: '', subtitle: '', body: '' },
  mode: 'edit',
  messages: [],
  seeding: false,
  chatting: false,
  aiUnavailable: false,
  selection: { start: 0, end: 0 },
  caretRequest: { position: 0, nonce: 0 },
  hydrated: false,
};

function withCaret(state: ArticleState, position: number): ArticleState['caretRequest'] {
  return { position, nonce: state.caretRequest.nonce + 1 };
}

function reducer(state: ArticleState, action: Action): ArticleState {
  switch (action.type) {
    case 'HYDRATE':
      return { ...state, draft: action.draft, messages: action.messages, hydrated: true };
    case 'SET_TITLE':
      return { ...state, draft: { ...state.draft, title: action.value } };
    case 'SET_SUBTITLE':
      return { ...state, draft: { ...state.draft, subtitle: action.value } };
    case 'SET_BODY':
      return { ...state, draft: { ...state.draft, body: action.value } };
    case 'SET_BODY_WITH_CARET':
      return {
        ...state,
        draft: { ...state.draft, body: action.value },
        selection: { start: action.caret, end: action.caret },
        caretRequest: withCaret(state, action.caret),
      };
    case 'SET_MODE':
      return { ...state, mode: action.mode };
    case 'SET_SELECTION':
      return { ...state, selection: { start: action.start, end: action.end } };
    case 'SEED_START':
      return { ...state, seeding: true, draft: { ...state.draft, body: '' } };
    case 'SEED_TOKEN':
      return { ...state, draft: { ...state.draft, body: state.draft.body + action.text } };
    case 'SEED_DONE':
      return { ...state, seeding: false, draft: action.draft };
    case 'SEED_FAILED':
      return { ...state, seeding: false };
    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.message] };
    case 'APPEND_TOKEN':
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.id ? { ...m, content: m.content + action.text } : m
        ),
      };
    case 'FINISH_MESSAGE':
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.id
            ? {
                ...m,
                streaming: false,
                failed: action.failed,
                content: action.content ?? m.content,
              }
            : m
        ),
      };
    case 'CHAT_START':
      return { ...state, chatting: true };
    case 'CHAT_END':
      return { ...state, chatting: false };
    case 'CLEAR_CHAT':
      return { ...state, messages: [] };
    case 'SET_AI_UNAVAILABLE':
      return { ...state, aiUnavailable: action.value };
    default:
      return state;
  }
}

interface ArticleContextValue {
  state: ArticleState;
  qaSources: ReturnType<typeof collectQaSources>;
  setTitle: (v: string) => void;
  setSubtitle: (v: string) => void;
  setBody: (v: string) => void;
  setMode: (mode: ArticleEditorMode) => void;
  setSelection: (start: number, end: number) => void;
  insertMarkdown: (markdown: string, target: ArticleInsertTarget) => void;
  sendMessage: (text: string) => void;
  runQuickAction: (id: ArticleQuickActionId) => void;
  clearChat: () => void;
  regenerateDraft: () => void;
  downloadMarkdown: () => void;
}

const ArticleContext = createContext<ArticleContextValue | null>(null);

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Inserts a block, keeping one blank line between it and its neighbours. */
function spliceBlock(body: string, block: string, start: number, end: number): {
  next: string;
  caret: number;
} {
  const before = body.slice(0, start);
  const after = body.slice(end);
  const prefix = !before || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
  const suffix = !after || after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n';
  const next = `${before}${prefix}${block}${suffix}${after}`;
  return { next, caret: before.length + prefix.length + block.length };
}

export function ArticleProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { t, locale } = useI18n();
  const { state: workspace } = useWorkspace();
  const { keyword, goal, context, nodes, dashboardNodeIds } = workspace;

  const stateRef = useRef(state);
  stateRef.current = state;
  const abortRef = useRef<AbortController | null>(null);

  const qaSources = useMemo(() => collectQaSources(nodes), [nodes]);
  const widgetMarkdown = useMemo(
    () =>
      nodes
        .filter((n) => n.type === 'data' && dashboardNodeIds.includes(n.id))
        .map((n) => dataNodeToMarkdown(n as Extract<typeof n, { type: 'data' }>)),
    [nodes, dashboardNodeIds]
  );

  const postArticle = useCallback(
    async (payload: Record<string, unknown>, signal: AbortSignal): Promise<Response> => {
      const send = (byok?: string) =>
        fetch('/api/workspace/article', {
          method: 'POST',
          signal,
          headers: {
            'Content-Type': 'application/json',
            ...(byok ? { [GEMINI_BYOK_HEADER]: byok } : {}),
          },
          body: JSON.stringify(payload),
        });

      const res = await send();
      if (res.status === 503 || res.status === 429) {
        const byok = await loadGeminiApiKey();
        if (byok) return send(byok);
      }
      return res;
    },
    []
  );

  const basePayload = useCallback(
    () => ({
      keyword,
      goal,
      context: context ?? null,
      locale,
      pairs: qaSources.map((s) => ({ question: s.question, answer: s.answer })),
      widgets: widgetMarkdown,
    }),
    [keyword, goal, context, locale, qaSources, widgetMarkdown]
  );

  const runSeed = useCallback(async () => {
    if (stateRef.current.seeding || qaSources.length === 0) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    dispatch({ type: 'SEED_START' });
    let res: Response;
    try {
      res = await postArticle({ ...basePayload(), mode: 'seed' }, controller.signal);
    } catch {
      if (controller.signal.aborted) return;
      dispatch({ type: 'SEED_FAILED' });
      toast.error(t('ai.networkError'));
      return;
    }

    if (!res.ok || !res.body) {
      dispatch({ type: 'SEED_FAILED' });
      const err = (await res.json().catch(() => ({}))) as { code?: string; error?: string };
      if (err.code === 'NO_AI_CONFIGURED') {
        dispatch({ type: 'SET_AI_UNAVAILABLE', value: true });
        toast.info(t('article.unavailableNoAi'));
      } else {
        toast.error(err.error || t('article.seedFailed'));
      }
      return;
    }

    let raw = '';
    await consumeWorkspaceQueryStream(res, {
      onToken: (text) => {
        raw += text;
        dispatch({ type: 'SEED_TOKEN', text });
      },
      onMetadata: () => {},
      onDone: () => {
        const parsed = parseSeedDraft(raw);
        dispatch({
          type: 'SEED_DONE',
          draft: {
            title: parsed.title || keyword,
            subtitle: parsed.subtitle,
            body: parsed.body,
          },
        });
      },
      onError: (message) => {
        if (controller.signal.aborted) return;
        dispatch({ type: 'SEED_FAILED' });
        toast.error(message || t('article.seedFailed'));
      },
    });
  }, [basePayload, keyword, postArticle, qaSources.length, t]);

  const runChat = useCallback(
    async (userText: string, actionId?: ArticleQuickActionId) => {
      // Never interrupt a seed draft that is still streaming into the editor.
      if (stateRef.current.chatting || stateRef.current.seeding) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const history = stateRef.current.messages
        .filter((m) => !m.failed && m.content.trim())
        .map((m) => ({ role: m.role, content: m.content }));

      const userMessage: ArticleMessage = {
        id: newId('u'),
        role: 'user',
        content: userText,
      };
      const assistantId = newId('a');
      dispatch({ type: 'ADD_MESSAGE', message: userMessage });
      dispatch({
        type: 'ADD_MESSAGE',
        message: { id: assistantId, role: 'assistant', content: '', streaming: true },
      });
      dispatch({ type: 'CHAT_START' });

      const { draft, selection } = stateRef.current;
      const selectedText =
        selection.end > selection.start ? draft.body.slice(selection.start, selection.end) : '';

      let res: Response;
      try {
        res = await postArticle(
          {
            ...basePayload(),
            mode: 'chat',
            draft,
            selection: selectedText,
            messages: history,
            message: actionId ? undefined : userText,
            action: actionId,
          },
          controller.signal
        );
      } catch {
        if (controller.signal.aborted) return;
        dispatch({
          type: 'FINISH_MESSAGE',
          id: assistantId,
          failed: true,
          content: t('ai.networkError'),
        });
        dispatch({ type: 'CHAT_END' });
        return;
      }

      if (!res.ok || !res.body) {
        const err = (await res.json().catch(() => ({}))) as { code?: string; error?: string };
        if (err.code === 'NO_AI_CONFIGURED') {
          dispatch({ type: 'SET_AI_UNAVAILABLE', value: true });
        }
        dispatch({
          type: 'FINISH_MESSAGE',
          id: assistantId,
          failed: true,
          content: err.error || t('article.chatError'),
        });
        dispatch({ type: 'CHAT_END' });
        return;
      }

      await consumeWorkspaceQueryStream(res, {
        onToken: (text) => dispatch({ type: 'APPEND_TOKEN', id: assistantId, text }),
        onMetadata: () => {},
        onDone: () => dispatch({ type: 'FINISH_MESSAGE', id: assistantId }),
        onError: (message) => {
          if (controller.signal.aborted) return;
          dispatch({
            type: 'FINISH_MESSAGE',
            id: assistantId,
            failed: true,
            content: message || t('article.chatError'),
          });
        },
      });
      dispatch({ type: 'CHAT_END' });
    },
    [basePayload, postArticle, t]
  );

  // Restore a saved draft (server first, local cache as fallback), or seed a new one.
  useEffect(() => {
    if (!keyword || state.hydrated) return;
    let cancelled = false;

    void (async () => {
      const local = loadArticleDraft(keyword);
      let remote: StoredArticleDraft | null = null;
      try {
        remote = await fetchArticleDraftFromServer(keyword);
      } catch {
        remote = null;
      }
      if (cancelled) return;

      // Prefer whichever copy was edited more recently.
      const saved =
        remote && local
          ? (remote.updatedAt || 0) >= (local.updatedAt || 0)
            ? remote
            : local
          : (remote ?? local);

      // Keep the local cache in sync when the server wins.
      if (saved && remote && saved === remote) {
        saveArticleDraft(keyword, saved);
      }
      // Push a newer local draft up if the server is missing or older.
      if (saved && local && saved === local && (!remote || (local.updatedAt || 0) > (remote.updatedAt || 0))) {
        void saveArticleDraftToServer(keyword, local);
      }

      dispatch({
        type: 'HYDRATE',
        draft: saved
          ? { title: saved.title, subtitle: saved.subtitle, body: saved.body }
          : { title: '', subtitle: '', body: '' },
        messages: saved?.messages.map((m) => ({ ...m })) ?? [],
      });
      if (!saved?.body.trim()) void runSeed();
    })();

    return () => {
      cancelled = true;
    };
  }, [keyword, state.hydrated, runSeed]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Autosave: local cache immediately, then server (debounced).
  useEffect(() => {
    if (!state.hydrated || !keyword || state.seeding) return;
    const messages: StoredArticleMessage[] = state.messages
      .filter((m) => !m.streaming && !m.failed && m.content.trim())
      .slice(-40)
      .map((m) => ({ id: m.id, role: m.role, content: m.content }));
    const payload: StoredArticleDraft = {
      ...state.draft,
      messages,
      updatedAt: Date.now(),
    };
    // Local cache first so a refresh mid-flight still recovers the latest text.
    saveArticleDraft(keyword, payload);
    const timer = window.setTimeout(() => {
      void saveArticleDraftToServer(keyword, payload);
    }, 800);
    return () => window.clearTimeout(timer);
  }, [keyword, state.draft, state.messages, state.hydrated, state.seeding]);

  const insertMarkdown = useCallback((markdown: string, target: ArticleInsertTarget) => {
    const block = markdown.trim();
    if (!block) return;
    const current = stateRef.current;

    if (target === 'replace') {
      dispatch({ type: 'SET_BODY_WITH_CARET', value: block, caret: block.length });
      return;
    }

    const body = current.draft.body;
    const { start, end } =
      target === 'end'
        ? { start: body.length, end: body.length }
        : {
            start: Math.min(current.selection.start, body.length),
            end: Math.min(current.selection.end, body.length),
          };
    const { next, caret } = spliceBlock(body, block, start, end);
    dispatch({ type: 'SET_BODY_WITH_CARET', value: next, caret });
  }, []);

  const downloadMarkdown = useCallback(() => {
    const { draft } = stateRef.current;
    const markdown = buildArticleFileMarkdown(draft);
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const safeName =
      (draft.title.trim() || keyword).replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase() || 'article';
    anchor.href = url;
    anchor.download = `qx10-${safeName}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [keyword]);

  const value = useMemo<ArticleContextValue>(
    () => ({
      state,
      qaSources,
      setTitle: (v) => dispatch({ type: 'SET_TITLE', value: v }),
      setSubtitle: (v) => dispatch({ type: 'SET_SUBTITLE', value: v }),
      setBody: (v) => dispatch({ type: 'SET_BODY', value: v }),
      setMode: (mode) => dispatch({ type: 'SET_MODE', mode }),
      setSelection: (start, end) => dispatch({ type: 'SET_SELECTION', start, end }),
      insertMarkdown,
      sendMessage: (text) => {
        const trimmed = text.trim();
        if (trimmed) void runChat(trimmed);
      },
      runQuickAction: (id) => {
        const action = getArticleQuickAction(id);
        if (action) void runChat(t(action.labelKey), id);
      },
      clearChat: () => dispatch({ type: 'CLEAR_CHAT' }),
      regenerateDraft: () => void runSeed(),
      downloadMarkdown,
    }),
    [state, qaSources, insertMarkdown, runChat, runSeed, downloadMarkdown, t]
  );

  return <ArticleContext.Provider value={value}>{children}</ArticleContext.Provider>;
}

export function useArticle(): ArticleContextValue {
  const ctx = useContext(ArticleContext);
  if (!ctx) throw new Error('useArticle must be used within ArticleProvider');
  return ctx;
}
