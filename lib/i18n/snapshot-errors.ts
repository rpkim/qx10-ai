import type { SnapshotErrorCode } from '@/lib/workspace-snapshot';
import type { MessageKey } from './messages/types';

export const SNAPSHOT_ERROR_I18N_KEY: Record<SnapshotErrorCode, MessageKey> = {
  invalid_format: 'errors.snapshotInvalid',
  json_parse: 'errors.jsonUnreadable',
  browser_only: 'errors.browserOnly',
  no_keyword: 'errors.noKeyword',
  storage_full: 'errors.storageFull',
  no_saved: 'errors.noSavedWorkspace',
};
