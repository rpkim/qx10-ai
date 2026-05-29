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

  const signInHref = `/api/auth/google/start?next=${encodeURIComponent(next)}`;
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
    <main className="fixed inset-0 overflow-y-auto overscroll-y-contain bg-background [-webkit-overflow-scrolling:touch]">
      <div className="pointer-events-auto absolute right-4 top-4 z-20 flex items-center gap-2">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #00C49A 1px, transparent 1px), linear-gradient(to bottom, #00C49A 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          width: 600,
          height: 600,
          background:
            'radial-gradient(circle, rgba(0,196,154,0.06) 0%, transparent 70%)',
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-full w-full max-w-md flex-col items-center justify-center gap-8 px-6 py-16">
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2">
            <QX10Logo />
            <span
              className="text-3xl font-bold tracking-tight text-foreground"
              style={{ fontFamily: 'var(--font-space-grotesk)' }}
            >
              Qx<span style={{ color: '#00C49A' }}>10</span>.lol
            </span>
          </div>
          <p className="text-center text-sm text-muted-foreground">
            {t('auth.tagline')}
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 rounded-2xl border border-border bg-card/85 p-5 backdrop-blur-sm">
          <h1 className="text-base font-semibold text-foreground">{t('auth.signInTitle')}</h1>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t('auth.signInBlurb')}
          </p>

          <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
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

          <label className="mt-1 flex cursor-pointer items-start gap-2 rounded-xl border border-border bg-background/60 px-3 py-2.5 text-xs leading-relaxed">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 size-3.5 rounded border-border text-primary"
            />
            <span className="text-muted-foreground">
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

        <p className="px-2 text-center text-[11px] leading-relaxed text-muted-foreground/70">
          {t('auth.privacyNote')}
        </p>

        <Link
          href="/service/introduce"
          className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          {t('auth.tryDemo')}
        </Link>

        <nav className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground/80">
          <Link href="/legal/privacy" className="hover:text-foreground hover:underline">
            {t('legal.privacyTitle')}
          </Link>
          <span aria-hidden>·</span>
          <Link href="/legal/terms" className="hover:text-foreground hover:underline">
            {t('legal.termsTitle')}
          </Link>
          <span aria-hidden>·</span>
          <Link href="/legal/do-not-sell" className="hover:text-foreground hover:underline">
            {t('legal.doNotSellTitle')}
          </Link>
        </nav>
      </div>
    </main>
  );
}
