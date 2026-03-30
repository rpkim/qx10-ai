'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, CloudDownload, CloudUpload, LogOut } from 'lucide-react';
import { useI18n } from '@/components/i18n-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { registerWorkspaceVisit } from '@/lib/workspace-index';
import {
  listAllWorkspaceKeywordsInLocalStorage,
  loadWorkspaceFromLocalStorage,
  parseWorkspaceSnapshotString,
  saveWorkspaceToLocalStorage,
  serializeWorkspaceSnapshot,
} from '@/lib/workspace-snapshot';
import { workspaceUrl } from '@/lib/workspace-url';
import type { DriveManifest } from '@/lib/integrations/drive-manifest';

type Status = {
  connected: boolean;
  email: string | null;
  name: string | null;
};

export function SettingsClient() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<Status | null>(null);
  const [manifest, setManifest] = useState<DriveManifest | null>(null);
  const [busy, setBusy] = useState(false);
  const [restoreKw, setRestoreKw] = useState('');

  const startUrl = `/api/integrations/google/start?next=${encodeURIComponent('/settings')}`;

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/integrations/google/drive/status', { credentials: 'include' });
      const data = (await res.json()) as Status;
      setStatus(data);
      if (data.connected) {
        const m = await fetch('/api/integrations/google/drive/manifest', { credentials: 'include' });
        if (m.ok) {
          const j = (await m.json()) as { manifest?: DriveManifest };
          setManifest(j.manifest ?? null);
        } else {
          setManifest(null);
        }
      } else {
        setManifest(null);
      }
    } catch {
      setStatus({ connected: false, email: null, name: null });
      setManifest(null);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    const g = searchParams.get('gdrive');
    if (g === 'connected') {
      toast.success(t('settings.googleDrive.toastConnected'));
      router.replace('/settings', { scroll: false });
    } else if (g === 'error') {
      const reason = searchParams.get('reason') ?? '';
      toast.error(t('settings.googleDrive.toastError', { reason }));
      router.replace('/settings', { scroll: false });
    }
  }, [searchParams, router, t]);

  const onDisconnect = async () => {
    setBusy(true);
    try {
      await fetch('/api/integrations/google/disconnect', { method: 'POST', credentials: 'include' });
      toast.success(t('settings.googleDrive.disconnectedToast'));
      await refreshStatus();
    } catch {
      toast.error(t('settings.googleDrive.genericFail'));
    } finally {
      setBusy(false);
    }
  };

  const onPushAll = async () => {
    if (!status?.connected) return;
    setBusy(true);
    try {
      const keywords = listAllWorkspaceKeywordsInLocalStorage();
      if (keywords.length === 0) {
        toast.message(t('settings.googleDrive.pushAllNone'));
        return;
      }
      let pushed = 0;
      for (const kw of keywords) {
        const loaded = loadWorkspaceFromLocalStorage(kw);
        if (!loaded.ok) continue;
        const snapshotJson = serializeWorkspaceSnapshot(loaded.state);
        const res = await fetch('/api/integrations/google/drive/push', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ snapshotJson }),
        });
        if (res.ok) pushed += 1;
      }
      if (pushed === 0) {
        toast.error(t('settings.googleDrive.pushAllFail'));
      } else {
        toast.success(t('settings.googleDrive.pushAllDone', { count: pushed }));
      }
      await refreshStatus();
    } catch {
      toast.error(t('settings.googleDrive.pushAllFail'));
    } finally {
      setBusy(false);
    }
  };

  const onRestore = async () => {
    const kw = restoreKw.trim();
    if (!kw || !status?.connected) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/integrations/google/drive/pull?keyword=${encodeURIComponent(kw)}`,
        { credentials: 'include' }
      );
      if (!res.ok) {
        toast.error(t('settings.googleDrive.restoreFail'));
        return;
      }
      const data = (await res.json()) as { snapshotJson?: string };
      const raw = data.snapshotJson ?? '';
      const parsed = parseWorkspaceSnapshotString(raw);
      if (!parsed.ok) {
        toast.error(t('settings.googleDrive.restoreFail'));
        return;
      }
      const save = saveWorkspaceToLocalStorage(parsed.state);
      if (!save.ok) {
        toast.error(t('settings.googleDrive.restoreFail'));
        return;
      }
      registerWorkspaceVisit(parsed.state.keyword, parsed.state.goal);
      toast.success(t('settings.googleDrive.restoreDone'));
      router.push(workspaceUrl({ keyword: parsed.state.keyword, goal: parsed.state.goal }));
    } catch {
      toast.error(t('settings.googleDrive.restoreFail'));
    } finally {
      setBusy(false);
    }
  };

  const onRestoreAll = async () => {
    if (!status?.connected) return;
    setBusy(true);
    try {
      const m = await fetch('/api/integrations/google/drive/manifest', { credentials: 'include' });
      if (!m.ok) {
        toast.error(t('settings.googleDrive.restoreAllFail'));
        return;
      }
      const j = (await m.json()) as { manifest?: DriveManifest };
      const workspaces = j.manifest?.workspaces ?? [];
      const keywords = Array.from(new Set(workspaces.map((w) => w.keyword.trim()).filter(Boolean)));
      if (keywords.length === 0) {
        toast.message(t('settings.googleDrive.restoreAllNone'));
        return;
      }

      let restored = 0;
      for (const kw of keywords) {
        const res = await fetch(
          `/api/integrations/google/drive/pull?keyword=${encodeURIComponent(kw)}`,
          { credentials: 'include' }
        );
        if (!res.ok) continue;
        const data = (await res.json()) as { snapshotJson?: string };
        const raw = data.snapshotJson ?? '';
        const parsed = parseWorkspaceSnapshotString(raw);
        if (!parsed.ok) continue;
        const save = saveWorkspaceToLocalStorage(parsed.state);
        if (!save.ok) continue;
        registerWorkspaceVisit(parsed.state.keyword, parsed.state.goal);
        restored += 1;
      }

      if (restored === 0) {
        toast.error(t('settings.googleDrive.restoreAllFail'));
      } else {
        toast.success(t('settings.googleDrive.restoreAllDone', { count: restored }));
      }
    } catch {
      toast.error(t('settings.googleDrive.restoreAllFail'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col gap-8 px-4 py-10">
      <div>
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {t('settings.backHome')}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{t('settings.title')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t('settings.subtitle')}</p>
      </div>

      <section className="rounded-2xl border border-border bg-card/80 p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground">{t('settings.googleDrive.title')}</h2>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          {t('settings.googleDrive.blurb')}
        </p>

        <div className="mt-4 flex flex-col gap-3">
          {status === null ? (
            <p className="text-xs text-muted-foreground">{t('common.loading')}</p>
          ) : status.connected ? (
            <>
              <p className="text-xs text-muted-foreground">
                {t('settings.googleDrive.connectedAs', {
                  email: status.email ?? status.name ?? '—',
                })}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    window.location.href = startUrl;
                  }}
                >
                  {t('settings.googleDrive.reconnect')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void onDisconnect()}
                  disabled={busy}
                >
                  <LogOut className="mr-1.5 size-3.5" />
                  {t('settings.googleDrive.disconnect')}
                </Button>
                <div className="flex w-full min-w-0 flex-col gap-1">
                  <Button type="button" size="sm" className="w-fit" onClick={() => void onPushAll()} disabled={busy}>
                    <CloudUpload className="mr-1.5 size-3.5" />
                    {t('settings.googleDrive.pushAll')}
                  </Button>
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    {t('settings.googleDrive.pushAllHint')}
                  </p>
                </div>
              </div>
              {manifest && manifest.workspaces.length > 0 && (
                <div className="mt-3 rounded-lg border border-border/60 bg-background/50 p-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    {t('settings.googleDrive.remoteList')}
                  </p>
                  <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs">
                    {manifest.workspaces.map((w) => (
                      <li key={w.driveFileId} className="truncate text-foreground">
                        {w.keyword}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
                <span className="text-xs font-medium text-muted-foreground">
                  {t('settings.googleDrive.restoreLabel')}
                </span>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    value={restoreKw}
                    onChange={(e) => setRestoreKw(e.target.value)}
                    placeholder={t('settings.googleDrive.restorePlaceholder')}
                    className="text-sm"
                  />
                  <Button type="button" size="sm" onClick={() => void onRestore()} disabled={busy}>
                    {t('settings.googleDrive.restore')}
                  </Button>
                </div>
                <div className="pt-1">
                  <Button type="button" variant="outline" size="sm" onClick={() => void onRestoreAll()} disabled={busy}>
                    <CloudDownload className="mr-1.5 size-3.5" />
                    {t('settings.googleDrive.restoreAll')}
                  </Button>
                  <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                    {t('settings.googleDrive.restoreAllHint')}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">{t('settings.googleDrive.notConnected')}</p>
              <Button
                type="button"
                size="sm"
                className="w-fit"
                disabled={busy}
                onClick={() => {
                  window.location.href = startUrl;
                }}
              >
                {t('settings.googleDrive.connect')}
              </Button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
