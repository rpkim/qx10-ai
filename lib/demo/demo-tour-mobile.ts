'use client';

import { useEffect, useState, type RefObject } from 'react';

export const DEMO_TOUR_MOBILE_MAX_WIDTH = 639;

export function useDemoTourMobileLayout(): boolean {
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${DEMO_TOUR_MOBILE_MAX_WIDTH}px)`);
    const apply = () => setMobile(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  return mobile;
}

export function scrollTourTargetIntoView(
  targetRef: RefObject<HTMLElement | null>,
  mobile = false
) {
  window.requestAnimationFrame(() => {
    const el = targetRef.current;
    if (!el) return;

    el.scrollIntoView({
      behavior: 'smooth',
      block: mobile ? 'center' : 'center',
      inline: 'nearest',
    });

    if (!mobile) return;

    window.setTimeout(() => {
      const sheetReserve = Math.min(window.innerHeight * 0.42, 320);
      const rect = el.getBoundingClientRect();
      const overlap = rect.bottom - (window.innerHeight - sheetReserve);
      if (overlap > 0) {
        window.scrollBy({ top: overlap + 16, behavior: 'smooth' });
      }
    }, 350);
  });
}
