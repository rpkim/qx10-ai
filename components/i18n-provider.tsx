'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Locale } from '@/lib/i18n/constants';
import { htmlLangFor } from '@/lib/i18n/constants';
import { LOCALE_STORAGE_KEY } from '@/lib/i18n/constants';
import { dictionaries } from '@/lib/i18n/dictionaries';
import { interpolate } from '@/lib/i18n/interpolate';
import { readStoredLocale } from '@/lib/i18n/storage';
import { setRuntimeLocale } from '@/lib/i18n/runtime';
import type { MessageKey } from '@/lib/i18n/messages/types';

type I18nContextValue = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: MessageKey, vars?: Record<string, string | number | undefined>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => {
    const stored = readStoredLocale();
    setLocaleState(stored);
    setRuntimeLocale(stored);
    document.documentElement.lang = htmlLangFor(stored);
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    setRuntimeLocale(l);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
    document.documentElement.lang = htmlLangFor(l);
  }, []);

  const t = useCallback(
    (key: MessageKey, vars?: Record<string, string | number | undefined>) => {
      const raw = dictionaries[locale][key] ?? dictionaries.en[key] ?? key;
      return interpolate(raw, vars);
    },
    [locale]
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
