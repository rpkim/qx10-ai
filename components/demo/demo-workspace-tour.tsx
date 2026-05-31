'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { DemoTourDialog } from '@/components/demo/demo-tour-dialog';
import { scrollTourTargetIntoView, useDemoTourMobileLayout } from '@/lib/demo/demo-tour-mobile';
import { useIntroduceReveal } from '@/lib/introduce-reveal-context';
import { useWorkspace } from '@/lib/workspace-store';
import type { WorkspaceState } from '@/lib/types';
import type { MessageKey } from '@/lib/i18n/messages/types';

const TOUR_STORAGE_KEY = 'qx10.demo.workspaceTour.dismissed';

type DemoWorkspaceTourContextValue = {
  active: boolean;
  showQuestions: boolean;
  rootTargetRef: RefObject<HTMLDivElement | null>;
  dismiss: () => void;
};

const DemoWorkspaceTourContext = createContext<DemoWorkspaceTourContextValue | null>(null);

export function useDemoWorkspaceTourOptional() {
  return useContext(DemoWorkspaceTourContext);
}

type Rect = { top: number; left: number; width: number; height: number };

function measureTarget(el: HTMLElement | null): Rect | null {
  if (!el) return null;
  const pad = 10;
  const r = el.getBoundingClientRect();
  return {
    top: Math.max(8, r.top - pad),
    left: Math.max(8, r.left - pad),
    width: r.width + pad * 2,
    height: r.height + pad * 2,
  };
}

export function DemoWorkspaceTourProvider({ children }: { children: ReactNode }) {
  const mobileSheet = useDemoTourMobileLayout();
  const introduceReveal = useIntroduceReveal();
  const rootTargetRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [dialogReady, setDialogReady] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [showQuestions, setShowQuestions] = useState(false);
  const [rect, setRect] = useState<Rect | null>(null);

  const total = 2;
  const isLast = stepIndex === total - 1;

  const dismiss = useCallback(() => {
    try {
      window.sessionStorage.setItem(TOUR_STORAGE_KEY, '1');
    } catch {
      // ignore
    }
    setActive(false);
    setShowQuestions(true);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setActive(window.sessionStorage.getItem(TOUR_STORAGE_KEY) !== '1');
  }, []);

  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => setDialogReady(true), 700);
    return () => window.clearTimeout(timer);
  }, [active]);

  useEffect(() => {
    const revealedCount = introduceReveal?.revealedQueryIds.size ?? 0;
    if (revealedCount === 0) return;
    dismiss();
  }, [introduceReveal?.revealedQueryIds.size, dismiss]);

  const updateRect = useCallback(() => {
    if (!active || !dialogReady) return;
    setRect(measureTarget(rootTargetRef.current));
  }, [active, dialogReady]);

  useEffect(() => {
    if (!active || !dialogReady) return;
    updateRect();
    const id = window.requestAnimationFrame(updateRect);
    const timer = window.setTimeout(updateRect, 120);
    return () => {
      window.cancelAnimationFrame(id);
      window.clearTimeout(timer);
    };
  }, [active, dialogReady, stepIndex, showQuestions, updateRect]);

  useEffect(() => {
    if (!active || !dialogReady) return;
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);
    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [active, dialogReady, updateRect]);

  const goNext = () => {
    if (stepIndex === 0) {
      setShowQuestions(true);
      setStepIndex(1);
      return;
    }
    dismiss();
  };

  const goBack = () => {
    if (stepIndex === 0) return;
    setStepIndex(0);
    setShowQuestions(false);
  };

  useEffect(() => {
    if (!active || !dialogReady) return;
    scrollTourTargetIntoView(rootTargetRef, mobileSheet);
  }, [active, dialogReady, stepIndex, showQuestions, mobileSheet]);

  const stepTitleKey =
    stepIndex === 0 ? 'introduce.demoWsTourStep1Title' : 'introduce.demoWsTourStep2Title';
  const stepBodyKey =
    stepIndex === 0 ? 'introduce.demoWsTourStep1Body' : 'introduce.demoWsTourStep2Body';

  return (
    <DemoWorkspaceTourContext.Provider
      value={{ active, showQuestions, rootTargetRef, dismiss }}
    >
      {children}
      {active && dialogReady ? (
        <DemoTourDialog
          stepIndex={stepIndex}
          total={total}
          titleKey={stepTitleKey}
          bodyKey={stepBodyKey}
          rect={rect}
          mobileSheet={mobileSheet}
          dialogPlacement="below"
          showNext={!isLast}
          showBack={stepIndex > 0}
          onDismiss={dismiss}
          onBack={goBack}
          onNext={goNext}
        />
      ) : null}
    </DemoWorkspaceTourContext.Provider>
  );
}

export function clearDemoWorkspaceTourSession() {
  try {
    window.sessionStorage.removeItem(TOUR_STORAGE_KEY);
    window.sessionStorage.removeItem(FOLLOWUP_TOUR_STORAGE_KEY);
    window.sessionStorage.removeItem(CANVAS_TOUR_STORAGE_KEY);
    window.sessionStorage.removeItem(DASHBOARD_TOUR_STORAGE_KEY);
  } catch {
    // ignore
  }
}

const FOLLOWUP_TOUR_STORAGE_KEY = 'qx10.demo.followUpTour.dismissed';
const CANVAS_TOUR_STORAGE_KEY = 'qx10.demo.canvasTour.dismissed';
const DASHBOARD_TOUR_STORAGE_KEY = 'qx10.demo.dashboardTour.dismissed';

function revealedHasCompleteAnswerWithData(
  state: WorkspaceState,
  revealedIds: ReadonlySet<string>
): boolean {
  for (const qId of revealedIds) {
    const answer = state.nodes.find((n) => n.type === 'answer' && n.queryId === qId);
    if (!answer || answer.status !== 'complete') continue;
    if (state.nodes.some((n) => n.type === 'data' && n.parentId === answer.id)) return true;
  }
  return false;
}

function isCanvasTourTriggerReady(
  revealedCount: number,
  hasData: boolean,
  spotlightAnswerId: string | null,
  followUpDismissed: boolean
): boolean {
  if (!hasData || revealedCount === 0) return false;
  if (revealedCount >= 2) return true;
  return revealedCount >= 1 && followUpDismissed && !spotlightAnswerId;
}

type DemoFollowUpTourContextValue = {
  active: boolean;
  spotlightAnswerId: string | null;
  followUpTargetRef: RefObject<HTMLDivElement | null>;
  dismiss: () => void;
};

const DemoFollowUpTourContext = createContext<DemoFollowUpTourContextValue | null>(null);

export function useDemoFollowUpTourOptional() {
  return useContext(DemoFollowUpTourContext);
}

function TourDialog({
  stepIndex,
  total,
  titleKey,
  bodyKey,
  onDismiss,
  onBack,
  onNext,
  showNext,
  showBack,
  rect,
  dialogPlacement = 'above',
}: {
  stepIndex: number;
  total: number;
  titleKey: MessageKey;
  bodyKey: MessageKey;
  onDismiss: () => void;
  onBack?: () => void;
  onNext?: () => void;
  showNext: boolean;
  showBack: boolean;
  rect: Rect | null;
  dialogPlacement?: 'above' | 'below';
}) {
  const mobileSheet = useDemoTourMobileLayout();

  return (
    <DemoTourDialog
      stepIndex={stepIndex}
      total={total}
      titleKey={titleKey}
      bodyKey={bodyKey}
      rect={rect}
      mobileSheet={mobileSheet}
      dialogPlacement={dialogPlacement}
      showNext={showNext}
      showBack={showBack}
      onDismiss={onDismiss}
      onBack={onBack}
      onNext={onNext}
    />
  );
}

export function DemoFollowUpTourProvider({ children }: { children: ReactNode }) {
  const mobileSheet = useDemoTourMobileLayout();
  const introduceReveal = useIntroduceReveal();
  const followUpTargetRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [dialogReady, setDialogReady] = useState(false);
  const [rect, setRect] = useState<Rect | null>(null);
  const spotlightAnswerId = introduceReveal?.spotlightAnswerId ?? null;

  const dismiss = useCallback(() => {
    try {
      window.sessionStorage.setItem(FOLLOWUP_TOUR_STORAGE_KEY, '1');
    } catch {
      // ignore
    }
    setActive(false);
  }, []);

  useEffect(() => {
    if (!spotlightAnswerId) {
      setActive(false);
      return;
    }
    const revealedCount = introduceReveal?.revealedQueryIds.size ?? 0;
    if (revealedCount > 1) {
      setActive(false);
      return;
    }
    if (typeof window !== 'undefined' && window.sessionStorage.getItem(FOLLOWUP_TOUR_STORAGE_KEY) === '1') {
      return;
    }
    setActive(true);
    setDialogReady(false);
    const timer = window.setTimeout(() => setDialogReady(true), 500);
    return () => window.clearTimeout(timer);
  }, [spotlightAnswerId, introduceReveal?.revealedQueryIds.size]);

  useEffect(() => {
    const revealedCount = introduceReveal?.revealedQueryIds.size ?? 0;
    if (revealedCount > 1) dismiss();
  }, [introduceReveal?.revealedQueryIds.size, dismiss]);

  const updateRect = useCallback(() => {
    if (!active || !dialogReady) return;
    setRect(measureTarget(followUpTargetRef.current));
  }, [active, dialogReady]);

  useEffect(() => {
    if (!active || !dialogReady) return;
    updateRect();
    const id = window.requestAnimationFrame(updateRect);
    const timer = window.setTimeout(updateRect, 120);
    return () => {
      window.cancelAnimationFrame(id);
      window.clearTimeout(timer);
    };
  }, [active, dialogReady, spotlightAnswerId, updateRect]);

  useEffect(() => {
    if (!active || !dialogReady) return;
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);
    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [active, dialogReady, updateRect]);

  useEffect(() => {
    if (!active || !dialogReady) return;
    scrollTourTargetIntoView(followUpTargetRef, mobileSheet);
  }, [active, dialogReady, spotlightAnswerId, mobileSheet]);

  return (
    <DemoFollowUpTourContext.Provider
      value={{ active, spotlightAnswerId, followUpTargetRef, dismiss }}
    >
      {children}
      {active && dialogReady ? (
        <TourDialog
          stepIndex={0}
          total={1}
          titleKey="introduce.demoFollowUpTourTitle"
          bodyKey="introduce.demoFollowUpTourBody"
          onDismiss={dismiss}
          showNext={false}
          showBack={false}
          rect={rect}
        />
      ) : null}
    </DemoFollowUpTourContext.Provider>
  );
}

type DemoCanvasTourContextValue = {
  active: boolean;
  canvasGlow: boolean;
  dismiss: () => void;
};

const DemoCanvasTourContext = createContext<DemoCanvasTourContextValue | null>(null);

export function useDemoCanvasTourOptional() {
  return useContext(DemoCanvasTourContext);
}

export function DemoCanvasTourProvider({
  children,
  canvasButtonRef,
  cardsMode,
  onDismissed,
}: {
  children: ReactNode;
  canvasButtonRef: RefObject<HTMLButtonElement | null>;
  cardsMode: boolean;
  onDismissed?: () => void;
}) {
  const mobileSheet = useDemoTourMobileLayout();
  const { state } = useWorkspace();
  const introduceReveal = useIntroduceReveal();
  const [active, setActive] = useState(false);
  const [dialogReady, setDialogReady] = useState(false);
  const [rect, setRect] = useState<Rect | null>(null);

  const dismiss = useCallback(() => {
    try {
      window.sessionStorage.setItem(CANVAS_TOUR_STORAGE_KEY, '1');
    } catch {
      // ignore
    }
    setActive(false);
    onDismissed?.();
  }, [onDismissed]);

  const revealedCount = introduceReveal?.revealedQueryIds.size ?? 0;
  const hasData = introduceReveal
    ? revealedHasCompleteAnswerWithData(state, introduceReveal.revealedQueryIds)
    : false;
  const followUpDismissed =
    typeof window !== 'undefined' &&
    window.sessionStorage.getItem(FOLLOWUP_TOUR_STORAGE_KEY) === '1';
  const triggerReady = introduceReveal
    ? isCanvasTourTriggerReady(
        revealedCount,
        hasData,
        introduceReveal.spotlightAnswerId,
        followUpDismissed
      )
    : false;

  useEffect(() => {
    if (!cardsMode || !triggerReady) {
      setActive(false);
      return;
    }
    if (typeof window !== 'undefined' && window.sessionStorage.getItem(CANVAS_TOUR_STORAGE_KEY) === '1') {
      return;
    }
    setActive(true);
    setDialogReady(false);
    const timer = window.setTimeout(() => setDialogReady(true), 700);
    return () => window.clearTimeout(timer);
  }, [cardsMode, triggerReady]);

  useEffect(() => {
    if (!cardsMode) dismiss();
  }, [cardsMode, dismiss]);

  const updateRect = useCallback(() => {
    if (!active || !dialogReady) return;
    setRect(measureTarget(canvasButtonRef.current));
  }, [active, dialogReady, canvasButtonRef]);

  useEffect(() => {
    if (!active || !dialogReady) return;
    updateRect();
    const id = window.requestAnimationFrame(updateRect);
    const timer = window.setTimeout(updateRect, 120);
    return () => {
      window.cancelAnimationFrame(id);
      window.clearTimeout(timer);
    };
  }, [active, dialogReady, updateRect]);

  useEffect(() => {
    if (!active || !dialogReady) return;
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);
    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [active, dialogReady, updateRect]);

  useEffect(() => {
    if (!active || !dialogReady) return;
    scrollTourTargetIntoView(canvasButtonRef, mobileSheet);
  }, [active, dialogReady, canvasButtonRef, mobileSheet]);

  const canvasGlow = active && dialogReady && cardsMode;

  return (
    <DemoCanvasTourContext.Provider value={{ active: canvasGlow, canvasGlow, dismiss }}>
      {children}
      {active && dialogReady && cardsMode ? (
        <TourDialog
          stepIndex={0}
          total={1}
          titleKey="introduce.demoCanvasTourTitle"
          bodyKey="introduce.demoCanvasTourBody"
          onDismiss={dismiss}
          showNext={false}
          showBack={false}
          rect={rect}
          dialogPlacement="below"
        />
      ) : null}
    </DemoCanvasTourContext.Provider>
  );
}

function hasPinnedDashboardData(state: WorkspaceState): boolean {
  return state.dashboardNodeIds.some((id) =>
    state.nodes.some((n) => n.id === id && n.type === 'data')
  );
}

function isDashboardTourTriggerReady(state: WorkspaceState, canvasTourDone: boolean): boolean {
  if (!canvasTourDone) return false;
  if (typeof window !== 'undefined' && window.sessionStorage.getItem(DASHBOARD_TOUR_STORAGE_KEY) === '1') {
    return false;
  }
  return hasPinnedDashboardData(state);
}

type DemoDashboardTourContextValue = {
  active: boolean;
  dashboardGlow: boolean;
  dismiss: () => void;
};

const DemoDashboardTourContext = createContext<DemoDashboardTourContextValue | null>(null);

export function useDemoDashboardTourOptional() {
  return useContext(DemoDashboardTourContext);
}

export function DemoDashboardTourProvider({
  children,
  dashboardButtonRef,
  canvasTourDone,
}: {
  children: ReactNode;
  dashboardButtonRef: RefObject<HTMLButtonElement | null>;
  canvasTourDone: boolean;
}) {
  const mobileSheet = useDemoTourMobileLayout();
  const { state } = useWorkspace();
  const [active, setActive] = useState(false);
  const [dialogReady, setDialogReady] = useState(false);
  const [rect, setRect] = useState<Rect | null>(null);

  const dismiss = useCallback(() => {
    try {
      window.sessionStorage.setItem(DASHBOARD_TOUR_STORAGE_KEY, '1');
    } catch {
      // ignore
    }
    setActive(false);
  }, []);

  const triggerReady = isDashboardTourTriggerReady(state, canvasTourDone);

  useEffect(() => {
    if (!triggerReady) {
      setActive(false);
      return;
    }
    setActive(true);
    setDialogReady(false);
    const timer = window.setTimeout(() => setDialogReady(true), 700);
    return () => window.clearTimeout(timer);
  }, [triggerReady]);

  const updateRect = useCallback(() => {
    if (!active || !dialogReady) return;
    setRect(measureTarget(dashboardButtonRef.current));
  }, [active, dialogReady, dashboardButtonRef]);

  useEffect(() => {
    if (!active || !dialogReady) return;
    updateRect();
    const id = window.requestAnimationFrame(updateRect);
    const timer = window.setTimeout(updateRect, 120);
    return () => {
      window.cancelAnimationFrame(id);
      window.clearTimeout(timer);
    };
  }, [active, dialogReady, updateRect]);

  useEffect(() => {
    if (!active || !dialogReady) return;
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);
    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [active, dialogReady, updateRect]);

  useEffect(() => {
    if (!active || !dialogReady) return;
    scrollTourTargetIntoView(dashboardButtonRef, mobileSheet);
  }, [active, dialogReady, dashboardButtonRef, mobileSheet]);

  const dashboardGlow = active && dialogReady;

  return (
    <DemoDashboardTourContext.Provider value={{ active: dashboardGlow, dashboardGlow, dismiss }}>
      {children}
      {active && dialogReady ? (
        <TourDialog
          stepIndex={0}
          total={1}
          titleKey="introduce.demoDashboardTourTitle"
          bodyKey="introduce.demoDashboardTourBody"
          onDismiss={dismiss}
          showNext={false}
          showBack={false}
          rect={rect}
          dialogPlacement="below"
        />
      ) : null}
    </DemoDashboardTourContext.Provider>
  );
}
