'use client';

import { Spinner } from '@/components/ui/spinner';
import { useI18n } from '@/components/i18n-provider';

type WorkspaceLoadingScreenProps = {
  keyword?: string | null;
  variant?: 'loading' | 'initializing';
};

export function WorkspaceLoadingScreen({
  keyword,
  variant = 'loading',
}: WorkspaceLoadingScreenProps) {
  const { t } = useI18n();
  const message =
    variant === 'initializing' ? t('workspace.initializing') : t('workspace.loading');

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <div className="flex max-w-sm flex-col items-center gap-4 px-6 text-center">
        <Spinner className="size-10 text-primary" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{message}</p>
          {keyword ? (
            <p className="truncate text-xs text-muted-foreground">
              {t('workspace.loadingKeyword', { keyword })}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
