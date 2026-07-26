'use client';

import { useEffect, useRef, useState } from 'react';
import { Link2, Loader2, TriangleAlert, X } from 'lucide-react';
import { contextHostname, isHttpUrl, joinContextItems, parseContextItems } from '@/lib/context-items';
import { useI18n } from '@/components/i18n-provider';

type PreviewStatus = 'loading' | 'ready' | 'error';
interface PreviewState {
  status: PreviewStatus;
  title?: string;
}

/** Module-level so chip previews survive remounts (e.g. reopening the "new workspace" dialog). */
const previewCache = new Map<string, PreviewState>();

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  /** Fired when Enter is pressed while the draft text box is empty (e.g. to submit the parent form). */
  onEnterWithEmptyDraft?: () => void;
  autoFocus?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
}

/**
 * Tag-style input for workspace context: plain keywords AND URLs can be added as chips
 * (Enter / Tab / comma / paste). URL chips get a lightweight server-side preview (title),
 * and the full page content is fetched + summarized for the AI when generating seed questions.
 */
export function ContextChipInput({
  value,
  onChange,
  placeholder,
  className,
  inputClassName,
  onEnterWithEmptyDraft,
  autoFocus,
  onFocus,
  onBlur,
}: Props) {
  const { t } = useI18n();
  const [draft, setDraft] = useState('');
  const [, bump] = useState(0);
  const items = parseContextItems(value);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchPreview = (url: string) => {
    if (previewCache.has(url)) return;
    previewCache.set(url, { status: 'loading' });
    bump((n) => n + 1);
    fetch(`/api/workspace/url-preview?url=${encodeURIComponent(url)}`)
      .then((r) => r.json())
      .then((data: { title?: string; error?: string }) => {
        previewCache.set(url, data.title ? { status: 'ready', title: data.title } : { status: 'error' });
        bump((n) => n + 1);
      })
      .catch(() => {
        previewCache.set(url, { status: 'error' });
        bump((n) => n + 1);
      });
  };

  useEffect(() => {
    for (const item of items) {
      if (item.isUrl && !previewCache.has(item.value)) fetchPreview(item.value);
    }
    // Only re-scan when the underlying value changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const addItems = (raw: string[]) => {
    const existing = items.map((i) => i.value);
    const additions = raw.map((s) => s.trim()).filter(Boolean);
    if (additions.length === 0) return;
    onChange(joinContextItems([...existing, ...additions]));
    setDraft('');
  };

  const removeItem = (idx: number) => {
    onChange(joinContextItems(items.map((i) => i.value).filter((_, i) => i !== idx)));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Tab' || e.key === ',') {
      if (draft.trim()) {
        e.preventDefault();
        addItems([draft]);
        return;
      }
      if (e.key === 'Enter') onEnterWithEmptyDraft?.();
      return;
    }
    if (e.key === 'Backspace' && !draft && items.length > 0) {
      removeItem(items.length - 1);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text');
    if (!text) return;
    if (isHttpUrl(text.trim()) || /[,\n]/.test(text)) {
      e.preventDefault();
      addItems(text.split(/[,\n]/));
    }
  };

  const handleBlur = () => {
    if (draft.trim()) addItems([draft]);
    onBlur?.();
  };

  return (
    <div
      className={[
        'flex min-w-0 flex-1 flex-wrap items-center gap-1.5',
        className ?? '',
      ].join(' ')}
      onClick={() => inputRef.current?.focus()}
    >
      {items.map((item, idx) => {
        const preview = item.isUrl ? previewCache.get(item.value) : undefined;
        return (
          <span
            key={`${item.value}-${idx}`}
            className={[
              'inline-flex max-w-55 shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-xs',
              item.isUrl
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'border-border bg-secondary/70 text-foreground',
            ].join(' ')}
            title={item.isUrl ? item.value : undefined}
          >
            {item.isUrl && preview?.status === 'loading' && <Loader2 className="size-3 shrink-0 animate-spin" />}
            {item.isUrl && preview?.status === 'ready' && <Link2 className="size-3 shrink-0" />}
            {item.isUrl && preview?.status === 'error' && (
              <TriangleAlert className="size-3 shrink-0 text-amber-500" />
            )}
            <span className="truncate">
              {item.isUrl ? preview?.title || contextHostname(item.value) : item.value}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeItem(idx);
              }}
              className="shrink-0 rounded-full text-current/60 transition-opacity hover:opacity-70"
              aria-label="Remove"
            >
              <X className="size-3" />
            </button>
          </span>
        );
      })}
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onBlur={handleBlur}
        onFocus={onFocus}
        autoFocus={autoFocus}
        placeholder={items.length === 0 ? placeholder ?? t('toolbar.contextPlaceholder') : ''}
        className={[
          'min-w-20 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/50',
          inputClassName ?? '',
        ].join(' ')}
      />
    </div>
  );
}
