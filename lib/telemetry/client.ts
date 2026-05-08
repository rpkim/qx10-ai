/**
 * Lightweight client-side telemetry helper. All calls are best-effort;
 * failures never block the user flow.
 */

import type { GoalType } from '@/lib/types';

export function trackSearch(input: { keyword: string; goal: GoalType; surface?: string }): void {
  if (typeof window === 'undefined') return;
  try {
    void fetch('/api/telemetry/event', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        type: 'search',
        keyword: input.keyword,
        goal: input.goal,
        surface: input.surface,
      }),
    }).catch(() => {
      /* swallow */
    });
  } catch {
    /* swallow */
  }
}

export function trackConsent(version: string): void {
  if (typeof window === 'undefined') return;
  try {
    void fetch('/api/telemetry/event', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({ type: 'consent', consentVersion: version }),
    }).catch(() => {
      /* swallow */
    });
  } catch {
    /* swallow */
  }
}
