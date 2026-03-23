import type { Locale } from './constants';
import { dictionaries } from './dictionaries';
import type { MessageKey } from './messages/types';
import { interpolate } from './interpolate';

let runtimeLocale: Locale = 'en';

export function setRuntimeLocale(l: Locale): void {
  runtimeLocale = l;
}

export function getRuntimeLocale(): Locale {
  return runtimeLocale;
}

/** For non-React modules (e.g. workspace store). Synced by `I18nProvider`. */
export function tr(key: MessageKey, vars?: Record<string, string | number | undefined>): string {
  const raw = dictionaries[runtimeLocale][key] ?? dictionaries.en[key] ?? key;
  return interpolate(raw, vars);
}
