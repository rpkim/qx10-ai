'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  ArrowDownToLine,
  Copy,
  CornerDownLeft,
  Eraser,
  Loader2,
  Replace,
  Sparkles,
  TextCursorInput,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/components/i18n-provider';
import { useArticle, type ArticleInsertTarget, type ArticleMessage } from '@/lib/article-store';
import { ArticleMarkdownView } from '@/components/workspace/article-markdown-view';
import { splitProposalSegments } from '@/lib/article-markdown';
import { ARTICLE_QUICK_ACTIONS } from '@/lib/ai/article-prompts';

export function ArticleAgentPane() {
  const { t } = useI18n();
  const { state, sendMessage, runQuickAction, clearChat, insertMarkdown } = useArticle();
  const { messages, chatting, seeding, aiUnavailable, selection, draft } = state;
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const busy = chatting || seeding;

  const lastContent = messages[messages.length - 1]?.content ?? '';
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, lastContent]);

  const selectedText = useMemo(
    () =>
      selection.end > selection.start ? draft.body.slice(selection.start, selection.end).trim() : '',
    [selection, draft.body]
  );

  const submit = () => {
    const text = input.trim();
    if (!text || busy) return;
    sendMessage(text);
    setInput('');
  };

  const applyProposal = (markdown: string, target: ArticleInsertTarget) => {
    insertMarkdown(markdown, target);
    toast.success(target === 'replace' ? t('article.replacedAll') : t('article.applied'));
  };

  return (
    <div className="flex h-full min-h-0 flex-col border-l border-border bg-card/40">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Sparkles className="size-4 shrink-0 text-primary" />
          <span className="truncate text-sm font-semibold text-foreground">
            {t('article.agentTitle')}
          </span>
        </div>
        {messages.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs text-muted-foreground"
            onClick={clearChat}
            disabled={chatting}
          >
            <Eraser className="size-3.5" />
            <span className="hidden sm:inline">{t('article.clearChat')}</span>
          </Button>
        )}
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3 sm:px-4">
        {aiUnavailable && (
          <p className="rounded-xl border border-border bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
            {t('article.unavailableNoAi')}
          </p>
        )}
        {messages.length === 0 && !aiUnavailable && (
          <p className="rounded-xl border border-dashed border-border px-3 py-3 text-xs leading-relaxed text-muted-foreground">
            {t('article.agentIntro')}
          </p>
        )}
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} onApply={applyProposal} />
        ))}
      </div>

      <div className="shrink-0 border-t border-border px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-4">
        <div className="mb-2 flex items-center gap-1.5">
          <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t('article.quickTips')}
          </span>
        </div>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {ARTICLE_QUICK_ACTIONS.map((action) => (
            <button
              key={action.id}
              type="button"
              disabled={busy}
              onClick={() => runQuickAction(action.id)}
              className="rounded-full border border-border bg-secondary/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
            >
              {t(action.labelKey)}
            </button>
          ))}
        </div>

        {selectedText && (
          <p className="mb-2 truncate rounded-lg border border-primary/30 bg-primary/5 px-2 py-1 text-[11px] text-primary">
            {t('article.selectionBadge')}: {selectedText.slice(0, 80)}
          </p>
        )}

        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            rows={2}
            placeholder={t('article.chatPlaceholder')}
            aria-label={t('article.chatPlaceholder')}
            className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary/50 placeholder:text-muted-foreground/60"
          />
          <Button
            type="button"
            size="icon"
            className="size-10 shrink-0"
            onClick={submit}
            disabled={busy || !input.trim()}
            aria-label={t('article.send')}
            title={t('article.send')}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CornerDownLeft className="size-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface MessageBubbleProps {
  message: ArticleMessage;
  onApply: (markdown: string, target: ArticleInsertTarget) => void;
}

function MessageBubble({ message, onApply }: MessageBubbleProps) {
  const { t } = useI18n();

  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary/15 px-3 py-2 text-sm text-foreground">
          {message.content}
        </p>
      </div>
    );
  }

  if (message.failed) {
    return (
      <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
        {message.content || t('article.chatError')}
      </p>
    );
  }

  if (!message.content.trim()) {
    return (
      <p className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        {t('article.thinking')}
      </p>
    );
  }

  const segments = splitProposalSegments(message.content);

  return (
    <div className="space-y-2">
      {segments.map((segment, idx) =>
        segment.kind === 'text' ? (
          <div key={idx} className="rounded-2xl rounded-bl-sm bg-secondary/50 px-3 py-2">
            <ArticleMarkdownView markdown={segment.content} size="compact" />
          </div>
        ) : (
          <ProposalCard
            key={idx}
            markdown={segment.content}
            streaming={!segment.complete}
            onApply={onApply}
          />
        )
      )}
    </div>
  );
}

interface ProposalCardProps {
  markdown: string;
  streaming: boolean;
  onApply: (markdown: string, target: ArticleInsertTarget) => void;
}

function ProposalCard({ markdown, streaming, onApply }: ProposalCardProps) {
  const { t } = useI18n();

  return (
    <div className="overflow-hidden rounded-xl border border-primary/30 bg-primary/4">
      <div className="flex items-center gap-2 border-b border-primary/20 px-3 py-1.5">
        <Sparkles className="size-3.5 text-primary" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-primary">
          {t('article.proposalTitle')}
        </span>
        {streaming && <Loader2 className="size-3 animate-spin text-primary" />}
      </div>
      <div className="max-h-72 overflow-y-auto px-3 py-2">
        <ArticleMarkdownView markdown={markdown} size="compact" />
      </div>
      {!streaming && (
        <div className="flex flex-wrap gap-1.5 border-t border-primary/20 px-3 py-2">
          <Button
            type="button"
            size="sm"
            className="h-7 gap-1.5 text-[11px]"
            onClick={() => onApply(markdown, 'cursor')}
          >
            <TextCursorInput className="size-3.5" />
            {t('article.applyInsert')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 text-[11px]"
            onClick={() => onApply(markdown, 'end')}
          >
            <ArrowDownToLine className="size-3.5" />
            {t('article.applyAppend')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 text-[11px]"
            onClick={() => onApply(markdown, 'replace')}
          >
            <Replace className="size-3.5" />
            {t('article.applyReplace')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 gap-1.5 text-[11px] text-muted-foreground"
            onClick={() => {
              void navigator.clipboard
                .writeText(markdown)
                .then(() => toast.success(t('article.copied')));
            }}
          >
            <Copy className="size-3.5" />
            {t('article.applyCopy')}
          </Button>
        </div>
      )}
    </div>
  );
}
