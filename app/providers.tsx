'use client';

import * as React from 'react';
import { ThemeProvider, useTheme } from 'next-themes';
import { Toaster } from 'sonner';
import { I18nProvider } from '@/components/i18n-provider';

function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      richColors
      position="top-center"
      theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
    />
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        {children}
        <ThemedToaster />
      </ThemeProvider>
    </I18nProvider>
  );
}
