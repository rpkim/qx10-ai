'use client';

import * as React from 'react';
import { Toaster } from 'sonner';
import { I18nProvider } from '@/components/i18n-provider';
import { ThemeProvider, useTheme } from '@/components/theme-provider';

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
      <ThemeProvider>
        {children}
        <ThemedToaster />
      </ThemeProvider>
    </I18nProvider>
  );
}
