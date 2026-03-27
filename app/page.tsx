'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { GoalType } from '@/lib/types';
import { toast } from 'sonner';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageSwitcher } from '@/components/language-switcher';
import { useI18n } from '@/components/i18n-provider';
import { workspaceUrl } from '@/lib/workspace-url';
import { GOAL_LABEL_KEYS } from '@/lib/i18n/goal-keys';
import { KeyRound, Lock, LockOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  clearGeminiKeyEncrypted,
  hasEncryptedGeminiKey,
  loadGeminiKeyEncrypted,
  saveGeminiKeyEncrypted,
} from '@/lib/byok-gemini';
import {
  listRecentWorkspaces,
  removeWorkspaceVisit,
  type WorkspaceIndexEntry,
} from '@/lib/workspace-index';
import { readWorkspaceLaunch } from '@/lib/workspace-launch';
import { removeWorkspaceFromLocalStorage } from '@/lib/workspace-snapshot';
import { removeDashboardGrid } from '@/lib/dashboard-layout-storage';

const EXAMPLE_KEYWORDS = [
  'Quant Trading',
  'Large Language Models',
  'Climate Change',
  'Startup Strategy',
  'Blockchain',
];

export default function LandingPage() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [keyword, setKeyword] = useState('');
  const [goal, setGoal] = useState<GoalType>('learn');
  const [focused, setFocused] = useState(false);
  const [recent, setRecent] = useState<WorkspaceIndexEntry[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [byokOpen, setByokOpen] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [passphraseInput, setPassphraseInput] = useState('');
  const [byokBusy, setByokBusy] = useState(false);
  const [hasByok, setHasByok] = useState(false);
  const [byokUnlocked, setByokUnlocked] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startAnimPhase, setStartAnimPhase] = useState(false);

  const handleStart = () => {
    if (!keyword.trim() || starting) return;
    setStarting(true);
    setStartAnimPhase(false);
    window.requestAnimationFrame(() => setStartAnimPhase(true));
    const target = workspaceUrl({ keyword: keyword.trim(), goal });
    window.setTimeout(() => {
      router.push(target);
    }, 520);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleStart();
  };

  useEffect(() => {
    setRecent(listRecentWorkspaces(6));
    hasEncryptedGeminiKey()
      .then((v) => setHasByok(v))
      .catch(() => setHasByok(false));
  }, []);

  useEffect(() => {
    const apply = () => setIsMobile(window.innerWidth < 768);
    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, []);

  useEffect(() => {
    const launch = readWorkspaceLaunch(new URLSearchParams(window.location.search));
    if (!launch) return;
    router.replace(workspaceUrl({ keyword: launch.keyword, goal: launch.goal }));
  }, [router]);

  const dateFmt = new Intl.DateTimeFormat(locale === 'zh' ? 'zh-Hans' : locale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const goWorkspace = (entry: WorkspaceIndexEntry) => {
    router.push(workspaceUrl({ keyword: entry.keyword, goal: entry.goal }));
  };

  const goDashboardOnly = (entry: WorkspaceIndexEntry) => {
    router.push(
      workspaceUrl({
        keyword: entry.keyword,
        goal: entry.goal,
        view: 'dashboard',
      })
    );
  };

  const deleteWorkspace = (entry: WorkspaceIndexEntry) => {
    if (!window.confirm(t('landing.deleteWorkspaceConfirm'))) return;
    removeWorkspaceFromLocalStorage(entry.keyword);
    removeDashboardGrid(entry.keyword);
    removeWorkspaceVisit(entry.keyword);
    setRecent((prev) => prev.filter((x) => x.keyword !== entry.keyword));
    toast.success(t('landing.deleteWorkspaceDone'));
  };

  const saveByok = async () => {
    if (!apiKeyInput.trim() || !passphraseInput.trim()) {
      toast.error('API key and passphrase are required.');
      return;
    }
    setByokBusy(true);
    try {
      await saveGeminiKeyEncrypted(apiKeyInput, passphraseInput);
      setHasByok(true);
      setByokUnlocked(true);
      setApiKeyInput('');
      setPassphraseInput('');
      toast.success('Gemini key encrypted and stored in this browser.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save key');
    } finally {
      setByokBusy(false);
    }
  };

  const unlockByok = async () => {
    if (!passphraseInput.trim()) {
      toast.error('Passphrase is required.');
      return;
    }
    setByokBusy(true);
    try {
      await loadGeminiKeyEncrypted(passphraseInput);
      setByokUnlocked(true);
      setPassphraseInput('');
      toast.success('Gemini key verified and unlock-ready.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to unlock key');
    } finally {
      setByokBusy(false);
    }
  };

  const clearByok = async () => {
    setByokBusy(true);
    try {
      await clearGeminiKeyEncrypted();
      setHasByok(false);
      setByokUnlocked(false);
      setApiKeyInput('');
      setPassphraseInput('');
      toast.success('Stored Gemini key deleted.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete key');
    } finally {
      setByokBusy(false);
    }
  };

  return (
    <main className="relative flex h-screen w-screen flex-col items-center justify-start overflow-hidden bg-background">
      {starting && (
        <div className="pointer-events-none fixed inset-0 z-50">
          <div
            className={[
              'absolute flex items-center gap-2 transition-all duration-500 ease-in-out',
              startAnimPhase
                ? 'left-5 top-5 translate-x-0 translate-y-0 scale-75 opacity-100'
                : 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 scale-110 opacity-95',
            ].join(' ')}
          >
            <QX10Logo />
            <span
              className="text-3xl font-bold tracking-tight text-foreground"
              style={{ fontFamily: 'var(--font-space-grotesk)' }}
            >
              Qx<span style={{ color: '#00C49A' }}>10</span>.lol
            </span>
          </div>
        </div>
      )}
      <div className="pointer-events-auto absolute right-4 top-4 z-20 flex items-center gap-2">
        <button
          onClick={() => setByokOpen(true)}
          className="flex items-center gap-2 rounded-xl border border-border bg-card/90 px-3 py-2 text-sm font-medium text-muted-foreground backdrop-blur-sm transition-all hover:bg-secondary hover:text-foreground"
          title="Gemini API Key (Browser Only)"
        >
          <KeyRound className="size-4" />
          {byokUnlocked ? (
            <LockOpen className="size-3.5 text-emerald-500" />
          ) : (
            <Lock className="size-3.5" />
          )}
          BYOK
        </button>
        <LanguageSwitcher />
        <ThemeToggle />
      </div>
      <Dialog open={byokOpen} onOpenChange={setByokOpen}>
        <DialogContent className="border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Gemini BYOK (Browser Only)</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div className="text-xs text-muted-foreground">
              All data stays local in your browser. Gemini key is encrypted in IndexedDB (Web Crypto).
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Gemini API Key</span>
              <Input
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="AIza..."
                type="password"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Passphrase</span>
              <Input
                value={passphraseInput}
                onChange={(e) => setPassphraseInput(e.target.value)}
                placeholder="Enter passphrase"
                type="password"
              />
            </div>
            <div className="text-xs text-muted-foreground">
              Stored: {hasByok ? 'Yes' : 'No'} / Unlocked: {byokUnlocked ? 'Yes' : 'No'}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={unlockByok} disabled={byokBusy}>
              Unlock
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setByokUnlocked(false)}
              disabled={byokBusy}
            >
              Lock
            </Button>
            <Button type="button" variant="outline" onClick={clearByok} disabled={byokBusy}>
              Delete
            </Button>
            <Button type="button" onClick={saveByok} disabled={byokBusy}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Grid background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #00C49A 1px, transparent 1px), linear-gradient(to bottom, #00C49A 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* Glow orb */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          width: 600,
          height: 600,
          background:
            'radial-gradient(circle, rgba(0,196,154,0.06) 0%, transparent 70%)',
        }}
      />

      <div
        className={[
          'relative z-10 flex w-full flex-col px-6 transition-all duration-300 ease-out',
          isMobile
            ? 'h-full max-w-md justify-start gap-6 overflow-y-auto pb-8 pt-20'
            : 'max-w-2xl items-center gap-8 overflow-y-auto pb-10 pt-28',
          starting ? 'translate-y-2 opacity-0 blur-[1px]' : 'translate-y-0 opacity-100',
        ].join(' ')}
      >
        {/* Logo */}
        <div className={isMobile ? 'flex flex-col gap-2' : 'flex flex-col items-center gap-3'}>
          <div className="flex items-center gap-2">
            <QX10Logo />
            <span
              className="text-4xl font-bold tracking-tight text-foreground"
              style={{ fontFamily: 'var(--font-space-grotesk)' }}
              suppressHydrationWarning
            >
              Qx<span style={{ color: '#00C49A' }}>10</span>.lol
            </span>
            <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
              Question x10
            </span>
          </div>
          <p className={[isMobile ? 'text-left' : 'text-center', 'text-base leading-relaxed text-muted-foreground'].join(' ')}>
            {t('landing.subLead')}
            <span className="text-foreground/70">{t('landing.subAccent')}</span>
          </p>
        </div>

        {/* Keyword input */}
        <div className={isMobile ? 'flex w-full flex-col gap-3 rounded-2xl border border-border bg-card/80 p-3' : 'flex w-full flex-col gap-3'}>
          <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {t('landing.keywordPrompt')}
          </span>
          <div
            className={[
              'flex items-center gap-3 rounded-2xl border px-5 py-4 transition-all duration-200',
              focused
                ? 'border-primary shadow-[0_0_0_3px_rgba(0,196,154,0.12)]'
                : 'border-border bg-card',
            ].join(' ')}
            style={{ background: focused ? 'rgba(0,196,154,0.03)' : undefined }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="shrink-0 text-muted-foreground"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={handleKeyDown}
              placeholder={t('landing.keywordPlaceholder')}
              className="flex-1 bg-transparent text-base text-foreground placeholder:text-muted-foreground/50 outline-none"
            />
            <button
              onClick={handleStart}
              disabled={!keyword.trim() || starting}
              className={[
                'flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold transition-all duration-200',
                keyword.trim() && !starting
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-[0_0_12px_rgba(0,196,154,0.4)]'
                  : 'cursor-not-allowed bg-muted text-muted-foreground',
              ].join(' ')}
            >
              {starting ? 'Starting…' : t('landing.start')}
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Example keywords */}
          <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <span className="shrink-0 text-xs text-muted-foreground/60">{t('landing.tryLabel')}</span>
            {EXAMPLE_KEYWORDS.map((ex) => (
              <button
                key={ex}
                onClick={() => setKeyword(ex)}
                className="shrink-0 rounded-full border border-border px-2.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        {/* Recent workspaces */}
        <div className="flex w-full flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {t('landing.recentTitle')}
          </span>
          <div className="rounded-2xl border border-border bg-card/85 p-2 backdrop-blur-sm">
            {recent.length === 0 ? (
              <div className="px-3 py-4 text-sm text-muted-foreground">{t('landing.recentEmpty')}</div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {recent.map((entry) => (
                  <div
                    key={`${entry.keyword}-${entry.updatedAt}`}
                    className="flex items-center justify-between rounded-xl border border-transparent px-3 py-2 text-left transition-colors hover:border-primary/30 hover:bg-secondary/70"
                  >
                    <button
                      type="button"
                      onClick={() => goWorkspace(entry)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="truncate text-sm font-semibold text-foreground">{entry.keyword}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                          {t(GOAL_LABEL_KEYS[entry.goal])}
                        </span>
                        <span>{t('landing.lastUpdated', { date: dateFmt.format(new Date(entry.updatedAt)) })}</span>
                      </div>
                    </button>
                    <div className="ml-2 flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => goDashboardOnly(entry)}
                        className="rounded-lg border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                      >
                        {t('landing.viewDashboard')}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteWorkspace(entry)}
                        className="rounded-lg border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-destructive/50 hover:text-destructive"
                      >
                        {t('landing.deleteWorkspace')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function QX10Logo() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
      {/* Cube frame representing 10 dimensions */}
      <rect x="2" y="6" width="16" height="16" stroke="#00C49A" strokeWidth="1.5" />
      <rect x="8" y="12" width="16" height="16" stroke="#00C49A" strokeWidth="1.5" opacity="0.6" />
      {/* Connecting lines */}
      <line x1="2" y1="6" x2="8" y2="12" stroke="#00C49A" strokeWidth="1.5" />
      <line x1="18" y1="6" x2="24" y2="12" stroke="#00C49A" strokeWidth="1.5" />
      <line x1="2" y1="22" x2="8" y2="28" stroke="#00C49A" strokeWidth="1.5" />
      <line x1="18" y1="22" x2="24" y2="28" stroke="#00C49A" strokeWidth="1.5" />
      {/* Center dot */}
      <circle cx="18" cy="18" r="2" fill="#00C49A" />
    </svg>
  );
}
