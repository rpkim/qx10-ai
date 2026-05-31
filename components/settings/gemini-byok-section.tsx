'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, KeyRound, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/components/i18n-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  clearGeminiApiKey,
  hasStoredGeminiApiKey,
  loadGeminiApiKey,
  maskGeminiApiKey,
  saveGeminiApiKey,
} from '@/lib/byok/gemini-key-vault';

type QuotaInfo = {
  dailyCount: number;
  dailyLimit: number;
  remaining: number;
  resetsAt: number;
  tier: 'free' | 'premium' | 'admin';
  freeTierLimit: number;
  premiumTierLimit: number;
};

export function GeminiByokSection() {
  const { t } = useI18n();
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const [stored, setStored] = useState(false);
  const [masked, setMasked] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [quotaRes, hasKey] = await Promise.all([
        fetch('/api/user/quota', { credentials: 'include' }),
        Promise.resolve(hasStoredGeminiApiKey()),
      ]);
      if (quotaRes.ok) {
        setQuota((await quotaRes.json()) as QuotaInfo);
      }
      setStored(hasKey);
      if (hasKey) {
        const key = await loadGeminiApiKey();
        setMasked(key ? maskGeminiApiKey(key) : null);
      } else {
        setMasked(null);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onSave = async () => {
    setSaving(true);
    try {
      await saveGeminiApiKey(draft);
      setDraft('');
      toast.success(t('settings.byok.saved'));
      await refresh();
    } catch (e) {
      const code = e instanceof Error ? e.message : '';
      toast.error(code === 'invalid_format' ? t('settings.byok.invalidFormat') : t('settings.byok.saveFail'));
    } finally {
      setSaving(false);
    }
  };

  const onRemove = async () => {
    await clearGeminiApiKey();
    setDraft('');
    toast.success(t('settings.byok.removed'));
    await refresh();
  };

  const resetLabel = quota
    ? new Date(quota.resetsAt).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  return (
    <section className="rounded-2xl border border-border bg-card/80 p-5 shadow-sm">
      <div className="flex items-start gap-2">
        <KeyRound className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-foreground">{t('settings.byok.title')}</h2>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t('settings.byok.lead')}</p>
        </div>
      </div>

      {!loading && quota ? (
        <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5 text-xs">
          <p className="font-medium text-foreground">{t('settings.byok.usageTitle')}</p>
          <p className="mt-1 text-muted-foreground">
            {t('settings.byok.usageLine', {
              count: String(quota.dailyCount),
              limit: String(quota.dailyLimit),
              remaining: String(quota.remaining),
            })}
          </p>
          <p className="mt-1 text-muted-foreground/80">
            {t('settings.byok.tierLine', {
              tier:
                quota.tier === 'premium'
                  ? t('settings.byok.tierPremium')
                  : quota.tier === 'admin'
                    ? t('settings.byok.tierAdmin')
                    : t('settings.byok.tierFree'),
            })}
          </p>
          <p className="mt-1 text-muted-foreground/80">{t('settings.byok.resetsAt', { time: resetLabel })}</p>
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        <p className="text-xs leading-relaxed text-muted-foreground">{t('settings.byok.howTo')}</p>
        <ol className="list-decimal space-y-1.5 pl-4 text-xs leading-relaxed text-muted-foreground">
          <li>{t('settings.byok.step1')}</li>
          <li>{t('settings.byok.step2')}</li>
          <li>{t('settings.byok.step3')}</li>
        </ol>
        <a
          href="https://aistudio.google.com/apikey"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          {t('settings.byok.openAiStudio')}
          <ExternalLink className="size-3" aria-hidden />
        </a>
      </div>

      <div className="mt-4 rounded-xl border border-border/80 bg-muted/20 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
        {t('settings.byok.securityNote')}
      </div>

      {stored && masked ? (
        <p className="mt-4 text-xs text-muted-foreground">
          {t('settings.byok.currentKey')}{' '}
          <span className="font-mono text-foreground">{masked}</span>
        </p>
      ) : null}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          type="password"
          autoComplete="off"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={stored ? t('settings.byok.replacePlaceholder') : t('settings.byok.placeholder')}
          className="font-mono text-xs"
        />
        <div className="flex shrink-0 gap-2">
          <Button type="button" size="sm" disabled={saving || !draft.trim()} onClick={() => void onSave()}>
            {stored ? t('settings.byok.update') : t('settings.byok.save')}
          </Button>
          {stored ? (
            <Button type="button" size="sm" variant="outline" onClick={() => void onRemove()}>
              <Trash2 className="mr-1 size-3.5" aria-hidden />
              {t('settings.byok.remove')}
            </Button>
          ) : null}
        </div>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        {t('settings.byok.afterLimit')}{' '}
        <Link href="/settings" className="text-primary hover:underline">
          {t('settings.title')}
        </Link>
      </p>
    </section>
  );
}
