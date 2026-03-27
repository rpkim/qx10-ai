'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/components/theme-provider';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted ? resolvedTheme === 'dark' : true;
  const title = mounted ? (isDark ? 'Light mode' : 'Dark mode') : 'Toggle theme';
  const ariaLabel = mounted
    ? isDark
      ? 'Switch to light mode'
      : 'Switch to dark mode'
    : 'Toggle theme';

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card/90 text-muted-foreground backdrop-blur-sm transition-colors hover:bg-secondary hover:text-foreground ${className}`}
      title={title}
      aria-label={ariaLabel}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
