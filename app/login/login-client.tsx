'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageSwitcher } from '@/components/language-switcher';
import { useI18n } from '@/components/i18n-provider';

const CONSENT_VERSION = 'v1.3';
const CONSENT_LS_KEY = 'qx10:consent';

function safeNext(raw: string | null): string {
  if (!raw) return '/';
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/';
  return raw.slice(0, 512);
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.5 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C33.6 6.5 29 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5c10.7 0 19.5-8.7 19.5-19.5 0-1.2-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.6 16 18.9 13 24 13c3 0 5.7 1.1 7.8 2.9l5.7-5.7C33.6 6.5 29 4.5 24 4.5 16.3 4.5 9.7 8.6 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 43.5c5 0 9.5-1.9 12.9-5l-6-4.9C29 35 26.6 36 24 36c-5.2 0-9.6-3.4-11.2-8l-6.5 5C9.6 39.4 16.2 43.5 24 43.5z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.7 2-2 3.7-3.6 5l6 4.9c-.4.4 6.4-4.7 6.4-13.9 0-1.2-.1-2.3-.5-3.5z"
      />
    </svg>
  );
}

function QX10Logo() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden>
      <rect x="2" y="6" width="16" height="16" stroke="#00C49A" strokeWidth="1.5" />
      <rect x="8" y="12" width="16" height="16" stroke="#00C49A" strokeWidth="1.5" opacity="0.6" />
      <line x1="2" y1="6" x2="8" y2="12" stroke="#00C49A" strokeWidth="1.5" />
      <line x1="18" y1="6" x2="24" y2="12" stroke="#00C49A" strokeWidth="1.5" />
      <line x1="2" y1="22" x2="8" y2="28" stroke="#00C49A" strokeWidth="1.5" />
      <line x1="18" y1="22" x2="24" y2="28" stroke="#00C49A" strokeWidth="1.5" />
      <circle cx="18" cy="18" r="2" fill="#00C49A" />
    </svg>
  );
}

export function LoginClient() {
  const { t } = useI18n();
  const params = useSearchParams();
  const next = useMemo(() => safeNext(params.get('next')), [params]);
  const invite = useMemo(() => params.get('invite')?.trim() ?? '', [params]);
  const error = params.get('error');
  const deleted = params.get('deleted') === '1';
  const revokeUrl = params.get('revoke');
  const [submitting, setSubmitting] = useState(false);
  const [alreadySignedIn, setAlreadySignedIn] = useState(false);
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me', { credentials: 'include' })
      .then((r) => r.json() as Promise<{ authenticated?: boolean }>)
      .then((d) => {
        if (!cancelled && d.authenticated) setAlreadySignedIn(true);
      })
      .catch(() => {
        /* ignore */
      });
    try {
      if (window.localStorage.getItem(CONSENT_LS_KEY) === CONSENT_VERSION) {
        setConsent(true);
      }
    } catch {
      /* ignore */
    }
    return () => {
      cancelled = true;
    };
  }, []);

  const signInHref = invite
    ? `/api/auth/google/start?next=${encodeURIComponent(next)}&invite=${encodeURIComponent(invite)}`
    : `/api/auth/google/start?next=${encodeURIComponent(next)}`;
  const canSubmit = consent && !submitting;

  const handleSignInClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!canSubmit) {
      e.preventDefault();
      return;
    }
    try {
      window.localStorage.setItem(CONSENT_LS_KEY, CONSENT_VERSION);
    } catch {
      /* ignore */
    }
    setSubmitting(true);
  };

  return (
    <main className="fixed inset-0 flex flex-col overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #00C49A 1px, transparent 1px), linear-gradient(to bottom, #00C49A 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        <div
          className="absolute left-1/2 top-1/2 size-[min(600px,100dvh)] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(0,196,154,0.06) 0%, transparent 70%)',
          }}
        />
      </div>

      <header className="relative z-20 flex shrink-0 items-center justify-end gap-1 px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] sm:gap-2 sm:px-4">
        <LanguageSwitcher />
        <ThemeToggle />
      </header>

      <div className="relative z-10 min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
        <div className="mx-auto flex w-full min-w-0 max-w-md flex-col items-center gap-4 px-4 py-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:gap-6 sm:px-6 sm:py-6 md:min-h-full md:justify-center md:gap-8 md:py-12">
          <div className="flex w-full min-w-0 flex-col items-center gap-2 sm:gap-3">
            <div className="flex max-w-full items-center gap-2">
              <QX10Logo />
              <span
                className="truncate text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
                style={{ fontFamily: 'var(--font-space-grotesk)' }}
              >
                Qx<span style={{ color: '#00C49A' }}>10</span>.lol
              </span>
            </div>
            <p className="max-w-full text-balance text-center text-xs leading-snug text-muted-foreground sm:text-sm">
              {t('auth.tagline')}
            </p>
          </div>

          <div className="flex w-full min-w-0 max-w-full flex-col gap-2.5 rounded-2xl border border-border bg-card/85 p-4 backdrop-blur-sm sm:gap-3 sm:p-5">
            <h1 className="text-base font-semibold text-foreground">{t('auth.signInTitle')}</h1>
            <p className="text-balance text-xs leading-relaxed text-muted-foreground">
              {t('auth.signInBlurb')}
            </p>

            {invite ? (
              <p className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary">
                {t('auth.inviteBanner')}
              </p>
            ) : null}

            <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground break-words">
              <div className="font-semibold text-foreground">{t('auth.collectionTitle')}</div>
              <p className="mt-1">{t('auth.collectionBody')}</p>
              <p className="mt-1">{t('auth.collectionNoSale')}</p>
            </div>

          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {t('auth.signInError', { reason: String(error) })}
            </div>
          )}

          {deleted && (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400">
              {t('auth.deletedNotice')}
              {revokeUrl && (
                <>
                  {' '}
                  <a
                    href={revokeUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="font-medium underline-offset-2 hover:underline"
                  >
                    {t('auth.revokeAccess')}
                  </a>
                </>
              )}
            </div>
          )}

          <label className="mt-1 flex cursor-pointer items-start gap-2 rounded-xl border border-border bg-background/60 px-3 py-2.5 text-xs leading-relaxed break-words">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 size-3.5 shrink-0 rounded border-border text-primary"
            />
            <span className="min-w-0 text-muted-foreground">
              {t('auth.consentAgree')}{' '}
              <Link
                href="/legal/privacy"
                target="_blank"
                rel="noreferrer noopener"
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                {t('legal.privacyTitle')}
              </Link>{' '}
              {t('auth.consentAnd')}{' '}
              <Link
                href="/legal/terms"
                target="_blank"
                rel="noreferrer noopener"
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                {t('legal.termsTitle')}
              </Link>
              .
            </span>
          </label>

          <a
            href={signInHref}
            onClick={handleSignInClick}
            aria-disabled={!canSubmit}
            className={[
              'mt-1 inline-flex items-center justify-center gap-3 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground transition-all',
              !canSubmit
                ? 'pointer-events-none opacity-50'
                : 'hover:border-primary/50 hover:bg-secondary',
            ].join(' ')}
          >
            <GoogleGlyph />
            {submitting ? t('auth.signingIn') : t('auth.continueWithGoogle')}
          </a>

          {alreadySignedIn && (
            <Link
              href={next}
              className="text-center text-xs text-primary underline-offset-2 hover:underline"
            >
              {t('auth.alreadySignedIn')}
            </Link>
          )}
        </div>

          <p className="max-w-full text-balance px-1 text-center text-[11px] leading-relaxed text-muted-foreground/70">
            {t('auth.privacyNote')}
          </p>

          <Link
            href="/demo"
            className="inline-flex w-full items-center justify-center rounded-xl border border-primary/40 bg-primary/10 px-4 py-2.5 text-center text-sm font-semibold text-primary transition-colors hover:border-primary/60 hover:bg-primary/15 sm:w-auto"
          >
            {t('auth.tryDemo')}
          </Link>

          <nav className="flex w-full min-w-0 max-w-full flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[10px] leading-snug text-muted-foreground/80 sm:gap-x-3 sm:text-[11px]">
            <Link href="/legal/privacy" className="hover:text-foreground hover:underline">
              {t('legal.privacyTitle')}
            </Link>
            <span aria-hidden className="hidden sm:inline">
              ·
            </span>
            <Link href="/legal/terms" className="hover:text-foreground hover:underline">
              {t('legal.termsTitle')}
            </Link>
            <span aria-hidden className="hidden sm:inline">
              ·
            </span>
            <Link href="/legal/do-not-sell" className="hover:text-foreground hover:underline">
              {t('legal.doNotSellTitle')}
            </Link>
          </nav>
        </div>
      </div>
    </main>
  );
}
