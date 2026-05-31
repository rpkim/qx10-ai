'use client';

import { useCallback, useEffect, useState, type RefObject } from 'react';
import { DemoTourDialog } from '@/components/demo/demo-tour-dialog';
import { scrollTourTargetIntoView, useDemoTourMobileLayout } from '@/lib/demo/demo-tour-mobile';
import type { MessageKey } from '@/lib/i18n/messages/types';

const TOUR_STORAGE_KEY = 'qx10.demo.setupTour.dismissed';

type TourStepConfig = {
  targetRef: RefObject<HTMLElement | null>;
  titleKey: MessageKey;
  bodyKey: MessageKey;
  placement?: 'top' | 'bottom';
};

type DemoSetupTourProps = {
  steps: TourStepConfig[];
  onComplete?: () => void;
  onStepChange?: (info: { active: boolean; stepIndex: number; isLastStep: boolean }) => void;
};

type Rect = { top: number; left: number; width: number; height: number };

function measureTarget(el: HTMLElement | null): Rect | null {
  if (!el) return null;
  const pad = 8;
  const r = el.getBoundingClientRect();
  return {
    top: Math.max(8, r.top - pad),
    left: Math.max(8, r.left - pad),
    width: r.width + pad * 2,
    height: r.height + pad * 2,
  };
}

export function DemoSetupTour({ steps, onComplete, onStepChange }: DemoSetupTourProps) {
  const mobileSheet = useDemoTourMobileLayout();
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  const step = steps[stepIndex];
  const total = steps.length;
  const isLast = stepIndex === total - 1;

  const updateRect = useCallback(() => {
    if (!active || !step) return;
    setRect(measureTarget(step.targetRef.current));
  }, [active, step]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setActive(window.sessionStorage.getItem(TOUR_STORAGE_KEY) !== '1');
  }, []);

  useEffect(() => {
    if (!active) return;
    updateRect();
    const id = window.requestAnimationFrame(updateRect);
    const timer = window.setTimeout(updateRect, 120);
    return () => {
      window.cancelAnimationFrame(id);
      window.clearTimeout(timer);
    };
  }, [active, stepIndex, mobileSheet, updateRect]);

  useEffect(() => {
    if (!active) return;
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);
    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [active, updateRect]);

  useEffect(() => {
    if (!active || !step) return;
    scrollTourTargetIntoView(step.targetRef, mobileSheet);
  }, [active, stepIndex, step, mobileSheet]);

  useEffect(() => {
    onStepChange?.({ active, stepIndex, isLastStep: stepIndex === total - 1 });
  }, [active, stepIndex, total, onStepChange]);

  const dismiss = () => {
    window.sessionStorage.setItem(TOUR_STORAGE_KEY, '1');
    setActive(false);
    onComplete?.();
  };

  const goNext = () => {
    if (isLast) {
      dismiss();
      return;
    }
    setStepIndex((i) => Math.min(i + 1, total - 1));
  };

  const goBack = () => setStepIndex((i) => Math.max(i - 1, 0));

  if (!active || !step) return null;

  return (
    <DemoTourDialog
      stepIndex={stepIndex}
      total={total}
      titleKey={step.titleKey}
      bodyKey={step.bodyKey}
      rect={rect}
      mobileSheet={mobileSheet}
      dialogPlacement={step.placement === 'top' ? 'above' : 'below'}
      showNext={!isLast}
      showBack={stepIndex > 0}
      onDismiss={dismiss}
      onBack={goBack}
      onNext={goNext}
    />
  );
}
