export const LOCALES = ['en', 'ko', 'ja', 'es', 'zh'] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_STORAGE_KEY = 'qx10.locale';

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  ko: '한국어',
  ja: '日本語',
  es: 'Español',
  zh: '中文',
};

export function isLocale(v: string | null | undefined): v is Locale {
  return v === 'en' || v === 'ko' || v === 'ja' || v === 'es' || v === 'zh';
}

export function htmlLangFor(locale: Locale): string {
  if (locale === 'zh') return 'zh-Hans';
  return locale;
}
