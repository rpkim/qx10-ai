import { Suspense } from 'react';
import { SettingsClient } from './settings-client';

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
          Loading
        </div>
      }
    >
      <SettingsClient />
    </Suspense>
  );
}
