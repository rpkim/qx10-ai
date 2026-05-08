'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogIn, LogOut, Shield, User } from 'lucide-react';
import { useI18n } from '@/components/i18n-provider';

type Me = {
  authenticated: boolean;
  user?: {
    sub: string;
    email: string;
    name?: string | null;
    picture?: string | null;
    isAdmin?: boolean;
  };
};

export function UserMenu({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [avatarBroken, setAvatarBroken] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me', { credentials: 'include' })
      .then((r) => r.json() as Promise<Me>)
      .then((d) => {
        if (!cancelled) setMe(d);
      })
      .catch(() => {
        if (!cancelled) setMe({ authenticated: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const signOut = async () => {
    setSigningOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {
      /* ignore */
    } finally {
      setSigningOut(false);
      setOpen(false);
      router.replace('/login');
      router.refresh();
    }
  };

  if (!me) return null;

  if (!me.authenticated) {
    return (
      <Link
        href="/login"
        className="flex items-center gap-2 rounded-xl border border-border bg-card/90 px-3 py-2 text-sm font-medium text-muted-foreground backdrop-blur-sm transition-all hover:bg-secondary hover:text-foreground"
      >
        <LogIn className="size-4" />
        {compact ? null : t('auth.signIn')}
      </Link>
    );
  }

  const u = me.user!;
  const display = u.name?.trim() || u.email;
  const initial = (display || '?').slice(0, 1).toUpperCase();
  const showAvatar = !!u.picture && !avatarBroken;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-xl border border-border bg-card/90 px-2.5 py-1.5 text-sm font-medium text-muted-foreground backdrop-blur-sm transition-all hover:bg-secondary hover:text-foreground"
        title={u.email}
      >
        {showAvatar ? (
          /* Plain <img> avoids next/image config for an arbitrary host.
             `no-referrer` is required for googleusercontent.com avatars. */
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={u.picture!}
            alt=""
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
            onError={() => setAvatarBroken(true)}
            className="size-6 rounded-full object-cover"
          />
        ) : (
          <span className="flex size-6 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">
            {initial}
          </span>
        )}
        {!compact && <span className="max-w-40 truncate">{display}</span>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 top-[calc(100%+6px)] z-40 w-60 rounded-xl border border-border bg-popover p-1 text-sm shadow-md">
            <div className="px-3 py-2">
              <div className="flex items-center gap-2">
                <User className="size-4 text-muted-foreground" aria-hidden />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-foreground">{display}</div>
                  <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                </div>
              </div>
            </div>
            <div className="my-1 h-px bg-border" />
            {u.isAdmin && (
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-secondary"
              >
                <Shield className="size-4 text-primary" aria-hidden />
                {t('auth.adminConsole')}
              </Link>
            )}
            <Link
              href="/legal/privacy"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              {t('legal.privacyTitle')}
            </Link>
            <Link
              href="/legal/do-not-sell"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              {t('legal.doNotSellTitle')}
            </Link>
            <button
              type="button"
              disabled={signingOut}
              onClick={signOut}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-secondary disabled:opacity-60"
            >
              <LogOut className="size-4" aria-hidden />
              {signingOut ? t('auth.signingOut') : t('auth.signOut')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
