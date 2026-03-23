'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { GoalType } from '@/lib/types';

const GOALS: { id: GoalType; label: string; desc: string }[] = [
  { id: 'learn', label: 'Learn', desc: 'Understand deeply' },
  { id: 'research', label: 'Research', desc: 'Discover & analyze' },
  { id: 'build', label: 'Build', desc: 'Create something' },
  { id: 'analyze', label: 'Analyze', desc: 'Evaluate & compare' },
];

const EXAMPLE_KEYWORDS = [
  'Quant Trading',
  'Large Language Models',
  'Climate Change',
  'Startup Strategy',
  'Blockchain',
];

export default function LandingPage() {
  const router = useRouter();
  const [keyword, setKeyword] = useState('');
  const [goal, setGoal] = useState<GoalType>('learn');
  const [focused, setFocused] = useState(false);

  const handleStart = () => {
    if (!keyword.trim()) return;
    const params = new URLSearchParams({ keyword: keyword.trim(), goal });
    router.push(`/workspace?${params.toString()}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleStart();
  };

  return (
    <main className="relative flex h-screen w-screen flex-col items-center justify-center overflow-hidden bg-background">
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

      <div className="relative z-10 flex w-full max-w-2xl flex-col items-center gap-10 px-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2">
            <QX10Logo />
            <span
              className="text-4xl font-bold tracking-tight text-foreground"
              style={{ fontFamily: 'var(--font-space-grotesk)' }}
            >
              qx<span style={{ color: '#00C49A' }}>10</span>.ai
            </span>
          </div>
          <p className="text-center text-base leading-relaxed text-muted-foreground">
            Ask endlessly. Discover deeply.{' '}
            <span className="text-foreground/70">
              Build living knowledge trees by exploring infinite possibilities.
            </span>
          </p>
        </div>

        {/* Goal selector */}
        <div className="flex w-full flex-col gap-3">
          <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            What do you want to do?
          </span>
          <div className="grid grid-cols-4 gap-2">
            {GOALS.map((g) => (
              <button
                key={g.id}
                onClick={() => setGoal(g.id)}
                className={[
                  'flex flex-col items-center gap-1 rounded-xl border px-3 py-3 text-sm transition-all duration-200',
                  goal === g.id
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground',
                ].join(' ')}
              >
                <span className="font-semibold">{g.label}</span>
                <span className="text-xs opacity-60">{g.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Keyword input */}
        <div className="flex w-full flex-col gap-3">
          <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Start with a keyword or topic
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
              placeholder="e.g. Quant Trading, Climate Policy, LLMs..."
              className="flex-1 bg-transparent text-base text-foreground placeholder:text-muted-foreground/50 outline-none"
            />
            <button
              onClick={handleStart}
              disabled={!keyword.trim()}
              className={[
                'flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold transition-all duration-200',
                keyword.trim()
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-[0_0_12px_rgba(0,196,154,0.4)]'
                  : 'cursor-not-allowed bg-muted text-muted-foreground',
              ].join(' ')}
            >
              Start
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
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-muted-foreground/60">Try:</span>
            {EXAMPLE_KEYWORDS.map((ex) => (
              <button
                key={ex}
                onClick={() => setKeyword(ex)}
                className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        {/* Feature hints */}
        <div className="flex w-full gap-3">
          {[
            { icon: '⟆', label: 'Infinite Canvas', sub: 'Pan & zoom freely' },
            { icon: '⊕', label: 'Live Tree', sub: 'Branches expand on demand' },
            { icon: '⊞', label: 'Dashboard', sub: 'Pin insights as widgets' },
          ].map((f) => (
            <div
              key={f.label}
              className="flex flex-1 flex-col gap-1 rounded-xl border border-border bg-card px-4 py-3"
            >
              <span className="font-mono text-lg text-primary">{f.icon}</span>
              <span className="text-xs font-semibold text-foreground">{f.label}</span>
              <span className="text-xs text-muted-foreground">{f.sub}</span>
            </div>
          ))}
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
