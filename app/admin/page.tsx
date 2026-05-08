import { redirect } from 'next/navigation';
import { getAuthSession } from '@/lib/auth/session';
import { isAdminEmail } from '@/lib/auth/admin';
import { AdminClient } from './admin-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const session = await getAuthSession();
  if (!session) redirect('/login?next=/admin');
  if (!isAdminEmail(session.email)) redirect('/');
  return <AdminClient currentEmail={session.email} />;
}
