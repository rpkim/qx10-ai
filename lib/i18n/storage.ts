import { LOCALE_STORAGE_KEY, isLocale, type Locale } from './constants';

export function readStoredLocale(): Locale {
  if (typeof window === 'undefined') return 'en';
  try {
    const v = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(v)) return v;
  } catch {
    /* ignore */
  }
  return 'en';
}
