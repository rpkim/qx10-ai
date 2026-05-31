import type { AuthSession } from '@/lib/auth/session';
import { getAnalyticsStore } from '@/lib/server/analytics/store';
import { ensureAdminTierForUser } from '@/lib/server/quota/sync-admin-tier';

/**
 * Workspaces (and user_prefs) reference public.users(sub). Users are normally
 * created on Google sign-in, but an existing session cookie may outlive a fresh
 * DB or a failed analytics upsert — ensure the row exists before writes.
 */
export async function ensureUserRecordForSession(session: AuthSession): Promise<void> {
  const store = getAnalyticsStore();
  const existing = await store.getUser(session.sub);
  if (existing) return;

  await store.upsertUserOnSignIn({
    sub: session.sub,
    email: session.email,
    name: session.name,
    picture: session.picture,
    ts: Date.now(),
  });
  const created = await store.getUser(session.sub);
  if (created) await ensureAdminTierForUser(store, created);
}
