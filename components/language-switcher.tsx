'use client';

import { Languages } from 'lucide-react';
import { LOCALES, LOCALE_LABELS, type Locale } from '@/lib/i18n/constants';
import { useI18n } from '@/components/i18n-provider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex size-9 items-center justify-center rounded-xl border border-border bg-card/90 text-muted-foreground backdrop-blur-sm transition-colors hover:bg-secondary hover:text-foreground"
          aria-label="Language"
          title="Language"
        >
          <Languages className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        {LOCALES.map((code) => (
          <DropdownMenuItem
            key={code}
            className={locale === code ? 'bg-primary/10 text-primary' : ''}
            onSelect={() => setLocale(code as Locale)}
          >
            {LOCALE_LABELS[code]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
