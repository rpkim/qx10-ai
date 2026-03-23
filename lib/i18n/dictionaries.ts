import type { Locale } from './constants';
import type { MessageKey } from './messages/types';
import { en } from './messages/en';
import { ko } from './messages/ko';
import { ja } from './messages/ja';
import { es } from './messages/es';
import { zh } from './messages/zh';

export const dictionaries: Record<Locale, Record<MessageKey, string>> = {
  en,
  ko,
  ja,
  es,
  zh,
};
