'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AlertTriangle, ArrowLeft, CloudUpload, Download, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useI18n } from '@/components/i18n-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserMenu } from '@/components/auth/user-menu';
import {
  hasLocalWorkspaceData,
  migrateBrowserLocalStorageToServer,
} from '@/lib/workspace-local-migration';
import { GeminiByokSection } from '@/components/settings/gemini-byok-section';

export function SettingsClient() {
  const { t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [localData, setLocalData] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setLocalData(hasLocalWorkspaceData());
  }, []);

  const onMigrateLocal = async () => {
    setBusy(true);
    try {
      const count = await migrateBrowserLocalStorageToServer();
      setLocalData(hasLocalWorkspaceData());
      toast.success(t('settings.storage.migrateDone', { count }));
    } catch {
      toast.error(t('settings.storage.migrateFail'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
      <div className="mx-auto flex min-h-full max-w-lg flex-col gap-8 px-4 py-10 pb-[max(6rem,env(safe-area-inset-bottom))]">
        <div>
          <Link
            href="/"
            className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            {t('settings.backHome')}
          </Link>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight">{t('settings.title')}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{t('settings.subtitle')}</p>
            </div>
            <UserMenu />
          </div>
        </div>

        <section className="rounded-2xl border border-border bg-card/80 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground">{t('settings.storage.title')}</h2>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            {t('settings.storage.blurb')}
          </p>
          {localData && (
            <div className="mt-4 flex flex-col gap-2">
              <p className="text-xs text-muted-foreground">{t('settings.storage.localFound')}</p>
              <Button
                type="button"
                size="sm"
                className="w-fit"
                disabled={busy}
                onClick={() => void onMigrateLocal()}
              >
                <CloudUpload className="mr-1.5 size-3.5" />
                {t('settings.storage.migrateButton')}
              </Button>
            </div>
          )}
        </section>

        <GeminiByokSection />

        <section className="rounded-2xl border border-border bg-card/80 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground">{t('settings.privacy.title')}</h2>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            {t('settings.privacy.exportBlurb')}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <Link
                href="/legal/privacy"
                className="rounded-lg border border-border px-2.5 py-1 transition-colors hover:border-primary/40 hover:text-foreground"
              >
                {t('legal.privacyTitle')}
              </Link>
              <Link
                href="/legal/terms"
                className="rounded-lg border border-border px-2.5 py-1 transition-colors hover:border-primary/40 hover:text-foreground"
              >
                {t('legal.termsTitle')}
              </Link>
              <Link
                href="/legal/do-not-sell"
                className="rounded-lg border border-border px-2.5 py-1 transition-colors hover:border-primary/40 hover:text-foreground"
              >
                {t('legal.doNotSellTitle')}
              </Link>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                window.location.href = '/api/auth/export-data';
              }}
            >
              <Download className="size-4" />
              {t('settings.privacy.exportButton')}
            </Button>
          </div>
        </section>

        <section className="rounded-2xl border border-destructive/40 bg-destructive/5 p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-destructive">
            <AlertTriangle className="size-4" />
            {t('settings.dangerZone.title')}
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            {t('settings.dangerZone.description')}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">{t('settings.dangerZone.scope')}</div>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setDeleteText('');
                setDeleteOpen(true);
              }}
            >
              <Trash2 className="size-4" />
              {t('settings.dangerZone.deleteButton')}
            </Button>
          </div>
        </section>
      </div>

      <Dialog open={deleteOpen} onOpenChange={(o) => (deleting ? null : setDeleteOpen(o))}>
        <DialogContent className="border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-destructive" />
              {t('settings.dangerZone.confirmTitle')}
            </DialogTitle>
            <DialogDescription>{t('settings.dangerZone.confirmBody')}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 py-2">
            <ul className="list-disc pl-5 text-xs leading-relaxed text-muted-foreground">
              <li>{t('settings.dangerZone.bullet1')}</li>
              <li>{t('settings.dangerZone.bullet2')}</li>
              <li>{t('settings.dangerZone.bullet3')}</li>
              <li>{t('settings.dangerZone.bullet4')}</li>
            </ul>
            <label className="mt-2 text-xs font-medium text-muted-foreground">
              {t('settings.dangerZone.confirmPrompt')}
            </label>
            <Input
              value={deleteText}
              onChange={(e) => setDeleteText(e.target.value)}
              placeholder="DELETE"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={deleting}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting || deleteText.trim().toUpperCase() !== 'DELETE'}
              onClick={async () => {
                setDeleting(true);
                try {
                  const res = await fetch('/api/auth/delete-account', {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ confirm: 'DELETE' }),
                  });
                  if (!res.ok) {
                    const j = (await res.json().catch(() => ({}))) as { error?: string };
                    throw new Error(j.error || `HTTP ${res.status}`);
                  }
                  const data = (await res.json()) as { revokeUrl?: string };
                  toast.success(t('settings.dangerZone.deletedToast'));
                  setDeleteOpen(false);
                  router.replace(
                    `/login?deleted=1${
                      data.revokeUrl ? `&revoke=${encodeURIComponent(data.revokeUrl)}` : ''
                    }`
                  );
                  router.refresh();
                } catch (e) {
                  toast.error(
                    `${t('settings.dangerZone.deleteFail')}: ${
                      e instanceof Error ? e.message : 'unknown'
                    }`
                  );
                  setDeleting(false);
                }
              }}
            >
              {deleting
                ? t('settings.dangerZone.deleting')
                : t('settings.dangerZone.deleteConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
