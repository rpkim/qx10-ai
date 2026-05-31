'use client';

import dynamic from 'next/dynamic';

const AdminClient = dynamic(
  () => import('./admin-client').then((m) => m.AdminClient),
  {
    ssr: false,
    loading: () => <AdminLoadingShell />,
  }
);

export function AdminShell({ currentEmail }: { currentEmail: string }) {
  return <AdminClient currentEmail={currentEmail} />;
}

function AdminLoadingShell() {
  return (
    <main className="fixed inset-0 overflow-y-auto bg-background">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted/60" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-2xl bg-muted/40" />
      </div>
    </main>
  );
}
