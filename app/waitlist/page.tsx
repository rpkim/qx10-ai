'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useI18n } from '@/components/i18n-provider';
import { ThemeToggle } from '@/components/theme-toggle';

function WaitlistContent() {
  const { t } = useI18n();
  const params = useSearchParams();
  const full = params.get('full') === '1';

  return (
    <main className="fixed inset-0 flex flex-col items-center justify-center bg-background px-4">
      <div className="absolute right-4 top-[max(0.75rem,env(safe-area-inset-top))]">
        <ThemeToggle />
      </div>
      <div className="max-w-md space-y-4 text-center">
        <h1 className="text-xl font-semibold text-foreground">{t('waitlist.title')}</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {full ? t('waitlist.leadFull') : t('waitlist.lead')}
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground/80">{t('waitlist.note')}</p>
        <Link
          href="/"
          className="inline-flex rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:border-primary/40"
        >
          {t('waitlist.backHome')}
        </Link>
      </div>
    </main>
  );
}

export default function WaitlistPage() {
  return (
    <Suspense fallback={null}>
      <WaitlistContent />
    </Suspense>
  );
}
