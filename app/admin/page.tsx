import { redirect } from 'next/navigation';
import { getAuthSession } from '@/lib/auth/session';
import { isAdminEmail } from '@/lib/auth/admin';
import { AdminShell } from './admin-shell';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const session = await getAuthSession();
  if (!session) redirect('/login?next=/admin');
  if (!isAdminEmail(session.email)) redirect('/');
  return <AdminShell currentEmail={session.email} />;
}
