import { Suspense } from 'react';
import { LoginClient } from './login-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Sign in — Qx10.lol',
};

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 flex items-center justify-center overflow-hidden bg-background text-sm text-muted-foreground">
          Loading…
        </div>
      }
    >
      <LoginClient />
    </Suspense>
  );
}
