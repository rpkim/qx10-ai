'use client';

import { useRef, useState } from 'react';

type CardStyleId = 'hanok' | 'taegeuk' | 'golden' | 'bts';

const CARD_STYLE_OPTIONS = [
  { id: 'hanok' as const, label: 'Hanok' },
  { id: 'taegeuk' as const, label: 'Taeguk' },
  { id: 'golden' as const, label: 'Golden' },
  { id: 'bts' as const, label: 'BTS' },
] as const;

const DEFAULT_CARD_STYLE: CardStyleId = CARD_STYLE_OPTIONS[0].id;

const KRNAME_CACHE_STORAGE_KEY = 'krname-ai-results-v1';
const KRNAME_CACHE_MAX_ENTRIES = 120;

type KrnameCachedPayload = {
  koreanName: string;
  pronunciationGuide: string;
  reason: string;
  cachedAt: number;
};

type KrnameCacheStore = Record<string, KrnameCachedPayload>;

function krnameCacheKey(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').normalize('NFC');
}

function readKrnameCache(): KrnameCacheStore {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(KRNAME_CACHE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as KrnameCacheStore;
  } catch {
    return {};
  }
}

function writeKrnameCache(store: KrnameCacheStore) {
  try {
    localStorage.setItem(KRNAME_CACHE_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // quota or private mode — ignore
  }
}

function getKrnameCached(rawName: string): KrnameCachedPayload | null {
  const key = krnameCacheKey(rawName);
  if (!key) return null;
  const hit = readKrnameCache()[key];
  if (!hit?.koreanName) return null;
  return hit;
}

function putKrnameCached(
  rawName: string,
  payload: { koreanName: string; pronunciationGuide: string; reason: string }
) {
  const key = krnameCacheKey(rawName);
  if (!key) return;
  const next: KrnameCacheStore = {
    ...readKrnameCache(),
    [key]: { ...payload, cachedAt: Date.now() },
  };
  const keys = Object.keys(next);
  if (keys.length > KRNAME_CACHE_MAX_ENTRIES) {
    const sortedByAge = keys.sort((a, b) => (next[a]?.cachedAt ?? 0) - (next[b]?.cachedAt ?? 0));
    for (const k of sortedByAge.slice(0, keys.length - KRNAME_CACHE_MAX_ENTRIES)) {
      delete next[k];
    }
  }
  writeKrnameCache(next);
}

export default function KoreanNamePage() {
  const [nameInput, setNameInput] = useState('');
  const [koreanName, setKoreanName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedCardStyle, setSelectedCardStyle] = useState<CardStyleId>(DEFAULT_CARD_STYLE);
  const [downloadingCard, setDownloadingCard] = useState(false);
  const koreanStyleCardExportRef = useRef<HTMLDivElement | null>(null);

  const generateKoreanName = async () => {
    const trimmedName = nameInput.trim();
    if (!trimmedName || loading) return;

    const cached = getKrnameCached(trimmedName);
    if (cached) {
      setErrorMessage('');
      setKoreanName(cached.koreanName);
      return;
    }

    setLoading(true);
    setErrorMessage('');
    try {
      const response = await fetch('/api/krname', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName }),
      });
      const data = (await response.json()) as {
        koreanName?: string;
        pronunciationGuide?: string;
        reason?: string;
        error?: string;
      };
      if (!response.ok || !data.koreanName) {
        throw new Error(data.error || 'Failed to generate Korean name');
      }
      const pronunciationGuide = data.pronunciationGuide ?? '';
      const reason = data.reason ?? '';
      setKoreanName(data.koreanName);
      putKrnameCached(trimmedName, {
        koreanName: data.koreanName,
        pronunciationGuide,
        reason,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate Korean name';
      setErrorMessage(message);
      setKoreanName('');
    } finally {
      setLoading(false);
    }
  };

  const downloadKoreanStyleCard = async () => {
    const node = koreanStyleCardExportRef.current;
    if (!node || downloadingCard) return;
    setDownloadingCard(true);
    setErrorMessage('');
    try {
      if (typeof document !== 'undefined' && document.fonts?.ready) {
        await document.fonts.ready;
        try {
          await document.fonts.load('700 40px "Noto Sans KR"');
          await document.fonts.load('400 14px "Noto Sans KR"');
        } catch {
          // ignore if font API unavailable
        }
      }
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(node, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
        backgroundColor: '#f8f6ef',
      });
      const safe = nameInput.trim().replace(/[^\w\u3400-\u9FFF-]+/g, '_').slice(0, 40) || 'card';
      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = url;
      link.download = `korean-name-card-${safe}.png`;
      link.click();
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : 'Could not download the card image.');
    } finally {
      setDownloadingCard(false);
    }
  };

  return (
    <main className="relative w-full overflow-x-hidden text-[#101018]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 -top-20 h-64 w-64 rounded-full bg-rose-200/50 blur-3xl" />
        <div className="absolute right-0 top-10 h-72 w-72 rounded-full bg-sky-200/50 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-emerald-200/40 blur-3xl" />
      </div>

      <div className="relative grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-3xl border border-[#d9d3c3] bg-white/85 p-5 shadow-lg backdrop-blur sm:p-6">
            <label className="mb-2 block text-sm font-semibold text-[#2e2e3d]" htmlFor="name-input">
              Name Input
            </label>
            <input
              id="name-input"
              value={nameInput}
              onChange={(event) => setNameInput(event.target.value)}
              placeholder="e.g. David / David Garcia / 王伟"
              className="w-full rounded-2xl border border-[#c9c1af] bg-white px-4 py-3 text-base shadow-sm outline-none transition focus:border-[#2f5d56] focus:ring-2 focus:ring-[#2f5d56]/20"
            />

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={generateKoreanName}
                disabled={!nameInput.trim() || loading}
                className="rounded-xl bg-[#34529d] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2b4483] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? 'Generating...' : 'Generate with AI'}
              </button>
            </div>
            {errorMessage ? <p className="mt-3 text-sm text-[#bf4f44]">{errorMessage}</p> : null}
          </div>

          <div
            className="relative overflow-hidden rounded-3xl p-6"
            style={{
              border: '1px solid #d9d3c3',
              backgroundImage: 'linear-gradient(135deg, #fffdf7 0%, #f8f3ea 50%, #f0f5f7 100%)',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
            }}
          >
            <div
              className="absolute right-3 top-3 rounded-full px-3 py-1 text-xs font-semibold tracking-wide text-[#24484b]"
              style={{ backgroundColor: 'rgba(255,255,255,0.92)' }}
            >
              Korean Style Card
            </div>

            <div
              ref={koreanStyleCardExportRef}
              className="relative mt-8 flex flex-col gap-4 overflow-hidden rounded-3xl p-4 sm:p-5"
              style={{
                color: '#101018',
                fontFamily: '"Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", "Segoe UI", sans-serif',
                border: '1px solid #d4cdc0',
                backgroundColor: 'rgba(255, 252, 247, 0.97)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 4px 18px rgba(0,0,0,0.07)',
              }}
            >
              <div
                className="relative rounded-2xl border px-5 py-6 text-center sm:px-6 sm:py-7"
                style={{
                  borderColor: '#d9d3c3',
                  borderWidth: 1,
                  backgroundColor: 'rgba(255,255,255,0.96)',
                  boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)',
                }}
              >
                <p
                  className="wrap-break-word text-4xl font-bold text-[#1e3f3f] sm:text-5xl"
                  style={{ lineHeight: 1.25 }}
                >
                  {loading ? '…' : koreanName || '한글 이름'}
                </p>
              </div>

              <KoreanIllustration variant={selectedCardStyle} />
            </div>

            <div className="mt-4 flex flex-nowrap gap-2 overflow-x-auto overscroll-x-contain pb-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]">
              {CARD_STYLE_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={selectedCardStyle === option.id}
                  onClick={() => setSelectedCardStyle(option.id)}
                  className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    selectedCardStyle === option.id
                      ? 'border-[#24484b] bg-[#24484b] text-white'
                      : 'border-[#cabfa9] text-[#4f4b59] hover:border-[#24484b]'
                  }`}
                  style={
                    selectedCardStyle === option.id
                      ? undefined
                      : { backgroundColor: 'rgba(255,255,255,0.88)' }
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>

            {koreanName ? (
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={downloadKoreanStyleCard}
                  disabled={downloadingCard}
                  className="relative z-10 rounded-xl border border-[#cabfa9] px-4 py-2.5 text-sm font-semibold text-[#24484b] transition disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.92)',
                    opacity: downloadingCard ? 0.55 : 1,
                  }}
                >
                  {downloadingCard ? 'Preparing…' : 'Download as Image'}
                </button>
              </div>
            ) : null}
          </div>
        </div>
    </main>
  );
}

function KoreanIllustration({ variant }: { variant: CardStyleId }) {
  if (variant === 'taegeuk') {
    return <TaegukIllustration />;
  }
  if (variant === 'golden') {
    return <PhotoCardIllustration src="/krname/golden.png" alt="Golden stage theme" />;
  }
  if (variant === 'bts') {
    return <PhotoCardIllustration src="/krname/bts.png" alt="BTS at Gyeongbokgung" />;
  }
  return <PhotoCardIllustration src="/krname/hanok.png" alt="Traditional Korean hanok" />;
}

function PhotoCardIllustration({ src, alt }: { src: string; alt: string }) {
  return (
    <div
      className="overflow-hidden rounded-2xl border border-[#d9d3c3]"
      style={{ backgroundColor: 'rgba(255,255,255,0.78)' }}
    >
      <img src={src} alt={alt} className="block h-auto w-full object-cover" crossOrigin="anonymous" />
    </div>
  );
}

function TaegukIllustration() {
  return (
    <div
      className="rounded-2xl border border-[#d9d3c3] p-3"
      style={{ backgroundColor: 'rgba(255,255,255,0.78)' }}
    >
      <svg
        viewBox="-36 -24 72 48"
        className="h-auto w-full rounded-xl"
        role="img"
        aria-label="Taegeukgi illustration"
      >
        <path fill="#fff" d="M-36-24h72v48h-72z" />
        <g transform="rotate(-56.31)">
          <g id="taegeuk-bar-group">
            <path
              id="taegeuk-bar-line"
              stroke="#000"
              strokeWidth="2"
              d="M-6-25H6m-12 3H6m-12 3H6"
            />
            <use href="#taegeuk-bar-line" y="44" />
          </g>
          <path stroke="#fff" d="M0 17v10" />
          <circle r="12" fill="#cd2e3a" />
          <path fill="#0047a0" d="M0-12A6 6 0 0 0 0 0a6 6 0 0 1 0 12 12 12 0 0 1 0-24Z" />
        </g>
        <g transform="rotate(-123.69)">
          <use href="#taegeuk-bar-group" />
          <path stroke="#fff" d="M0-23.5v3M0 17v3.5m0 3v3" />
        </g>
      </svg>
    </div>
  );
}
