'use client';

import { useRef, useState } from 'react';
import { useI18n } from '@/components/i18n-provider';
import type { GoalType } from '@/lib/types';
import { DemoSetupTour } from '@/components/demo/demo-setup-tour';

export type DemoSetupValues = {
  keyword: string;
  context: string;
  goal: GoalType;
};

type DemoSetupPanelProps = {
  sample: DemoSetupValues;
  onStart: (values: DemoSetupValues) => void;
};

export function DemoSetupPanel({ sample, onStart }: DemoSetupPanelProps) {
  const { t } = useI18n();
  const keywordRef = useRef<HTMLDivElement>(null);
  const contextRef = useRef<HTMLDivElement>(null);
  const runButtonRef = useRef<HTMLButtonElement>(null);
  const [keyword, setKeyword] = useState(sample.keyword);
  const [context, setContext] = useState(sample.context);
  const [focused, setFocused] = useState(false);
  const [contextFocused, setContextFocused] = useState(false);
  const [starting, setStarting] = useState(false);
  const [runDemoGlow, setRunDemoGlow] = useState(false);
  const [topicGlow, setTopicGlow] = useState(false);
  const [contextGlow, setContextGlow] = useState(false);

  const handleStart = () => {
    const trimmed = keyword.trim();
    if (!trimmed || starting) return;
    try {
      window.sessionStorage.setItem('qx10.demo.setupTour.dismissed', '1');
    } catch {
      // ignore
    }
    setStarting(true);
    window.setTimeout(() => {
      onStart({ keyword: trimmed, context: context.trim(), goal: sample.goal });
    }, 280);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleStart();
  };

  const tourSteps = [
    {
      targetRef: keywordRef,
      titleKey: 'introduce.demoTourStep1Title' as const,
      bodyKey: 'introduce.demoTourStep1Body' as const,
      placement: 'bottom' as const,
    },
    {
      targetRef: contextRef,
      titleKey: 'introduce.demoTourStep2Title' as const,
      bodyKey: 'introduce.demoTourStep2Body' as const,
      placement: 'bottom' as const,
    },
    {
      targetRef: runButtonRef,
      titleKey: 'introduce.demoTourStep3Title' as const,
      bodyKey: 'introduce.demoTourStep3Body' as const,
      placement: 'top' as const,
    },
  ];

  return (
    <>
      <DemoSetupTour
        steps={tourSteps}
        onStepChange={({ active, stepIndex, isLastStep }) => {
          setTopicGlow(active && stepIndex === 0);
          setContextGlow(active && stepIndex === 1);
          setRunDemoGlow(active && isLastStep);
        }}
        onComplete={() => {
          setTopicGlow(false);
          setContextGlow(false);
          setRunDemoGlow(false);
        }}
      />
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 pb-36 sm:gap-6 sm:px-8 sm:pb-10">
        <div className="rounded-2xl border border-primary/20 bg-primary/4 px-4 py-3 text-left sm:px-5 sm:py-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          {t('introduce.demoHowTitle')}
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-700 dark:text-muted-foreground sm:mt-2 sm:text-[15px]">
          {t('introduce.demoHowLead')}
        </p>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card/90 p-3 shadow-sm sm:p-4">
        <div className="flex min-w-0 flex-col gap-1 text-left">
          <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {t('landing.keywordPrompt')}
          </span>
          <p className="hidden text-xs text-muted-foreground sm:block">{t('introduce.demoHintKeyword')}</p>
        </div>

        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-stretch">
          <div
            ref={keywordRef}
            className={[
              'flex min-w-0 flex-1 items-center gap-3 rounded-2xl border px-4 py-3 transition-all duration-200',
              topicGlow
                ? 'demo-run-glow relative z-[102] border-primary bg-card ring-2 ring-primary/70 ring-offset-2 ring-offset-background'
                : focused
                  ? 'border-primary shadow-[0_0_0_3px_rgba(0,196,154,0.12)]'
                  : 'border-border bg-card',
            ].join(' ')}
            style={{ background: !topicGlow && focused ? 'rgba(0,196,154,0.03)' : undefined }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="shrink-0 text-muted-foreground"
              aria-hidden
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={handleKeyDown}
              placeholder={t('landing.keywordPlaceholder')}
              className="min-w-0 flex-1 bg-transparent text-base text-foreground placeholder:text-muted-foreground/50 outline-none"
            />
          </div>
          <button
            ref={runButtonRef}
            type="button"
            onClick={handleStart}
            disabled={!keyword.trim() || starting}
            className={[
              'flex w-full shrink-0 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-200 sm:w-auto sm:self-center sm:py-2',
              keyword.trim() && !starting
                ? [
                    'bg-primary text-primary-foreground hover:bg-primary/90',
                    runDemoGlow
                      ? 'demo-run-glow relative z-[102] ring-2 ring-primary/70 ring-offset-2 ring-offset-background'
                      : 'hover:shadow-[0_0_12px_rgba(0,196,154,0.4)]',
                  ].join(' ')
                : 'cursor-not-allowed bg-muted text-muted-foreground',
            ].join(' ')}
          >
            {starting ? t('introduce.demoStarting') : t('introduce.demoRun')}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex items-center gap-2 px-1">
            <span className="text-xs font-semibold uppercase tracking-widest text-primary/70">
              {t('toolbar.contextLabel')}
            </span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary/60">
              {t('toolbar.contextOptional')}
            </span>
          </div>
          <p className="hidden px-1 text-xs text-muted-foreground sm:block">{t('introduce.demoHintContext')}</p>
          <div
            ref={contextRef}
            className={[
              'flex min-w-0 items-center gap-3 rounded-2xl border-2 px-4 py-3 transition-all duration-200',
              contextGlow
                ? 'demo-run-glow relative z-[102] border-primary bg-primary/5 ring-2 ring-primary/70 ring-offset-2 ring-offset-background'
                : contextFocused
                  ? 'border-primary bg-primary/5 shadow-[0_0_0_4px_rgba(0,196,154,0.1)]'
                  : context
                    ? 'border-primary/40 bg-primary/3'
                    : 'border-dashed border-primary/25 bg-primary/2 hover:border-primary/40',
            ].join(' ')}
          >
            <span
              className={[
                'shrink-0 rounded-lg px-2 py-0.5 text-xs font-bold transition-colors',
                contextFocused || context ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
              ].join(' ')}
            >
              in
            </span>
            <input
              type="text"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              onFocus={() => setContextFocused(true)}
              onBlur={() => setContextFocused(false)}
              onKeyDown={handleKeyDown}
              placeholder={t('toolbar.contextPlaceholder')}
              className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none"
            />
            {context ? (
              <button
                type="button"
                onClick={() => setContext('')}
                className="shrink-0 rounded-full p-0.5 text-muted-foreground/50 transition-colors hover:text-muted-foreground"
                aria-label="Clear context"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
