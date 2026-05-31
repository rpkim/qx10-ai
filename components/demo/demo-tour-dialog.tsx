'use client';

import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useI18n } from '@/components/i18n-provider';
import type { MessageKey } from '@/lib/i18n/messages/types';

export type DemoTourRect = { top: number; left: number; width: number; height: number };

type DemoTourDialogProps = {
  stepIndex: number;
  total: number;
  titleKey: MessageKey;
  bodyKey: MessageKey;
  rect: DemoTourRect | null;
  mobileSheet: boolean;
  dialogPlacement?: 'above' | 'below';
  showNext: boolean;
  showBack: boolean;
  onDismiss: () => void;
  onBack?: () => void;
  onNext?: () => void;
};

export function DemoTourDialog({
  stepIndex,
  total,
  titleKey,
  bodyKey,
  rect,
  mobileSheet,
  dialogPlacement = 'below',
  showNext,
  showBack,
  onDismiss,
  onBack,
  onNext,
}: DemoTourDialogProps) {
  const { t } = useI18n();

  if (!rect) {
    return <div className="fixed inset-0 z-[100] bg-slate-900/30 pointer-events-none" aria-hidden />;
  }

  const desktopStyle =
    dialogPlacement === 'below'
      ? {
          top: Math.min(window.innerHeight - 220, rect.top + rect.height + 16),
          left: '50%',
          transform: 'translateX(-50%)',
          maxWidth: 'min(22rem, calc(100vw - 2rem))',
        }
      : {
          top: Math.max(16, rect.top - 12),
          left: '50%',
          transform: 'translate(-50%, -100%)',
          maxWidth: 'min(22rem, calc(100vw - 2rem))',
        };

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none" aria-live="polite">
      <div
        className="pointer-events-none absolute rounded-2xl ring-2 ring-primary/80 transition-all duration-300 ease-out"
        style={{
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.3)',
        }}
        aria-hidden
      />

      <div
        className={[
          'pointer-events-auto fixed z-[101] border border-border bg-card/95 shadow-2xl backdrop-blur-md',
          mobileSheet
            ? 'inset-x-0 bottom-0 max-h-[min(42vh,20rem)] overflow-y-auto rounded-t-2xl border-b-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]'
            : 'w-full rounded-2xl p-4',
        ].join(' ')}
        style={mobileSheet ? undefined : desktopStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby="demo-tour-title"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-[11px] font-bold tabular-nums tracking-widest text-primary">
              {String(stepIndex + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {t('introduce.demoTourLabel')}
            </span>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={t('introduce.demoTourSkip')}
          >
            <X className="size-4" />
          </button>
        </div>

        <h3 id="demo-tour-title" className="text-base font-semibold text-foreground">
          {t(titleKey)}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(bodyKey)}</p>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={onDismiss}
            className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {t('introduce.demoTourSkip')}
          </button>
          <div className="flex items-center gap-1.5">
            {showBack && onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-0.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
              >
                <ChevronLeft className="size-3.5" aria-hidden />
                {t('introduce.demoTourBack')}
              </button>
            ) : null}
            {showNext && onNext ? (
              <button
                type="button"
                onClick={onNext}
                className="inline-flex items-center gap-0.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                {t('introduce.demoTourNext')}
                <ChevronRight className="size-3.5" aria-hidden />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
