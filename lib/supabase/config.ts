/**
 * Supabase env (see https://supabase.com/docs/guides/getting-started/api-keys):
 *
 * - NEXT_PUBLIC_SUPABASE_URL — project URL (browser + server)
 * - NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY — client-safe (`sb_publishable_…`, replaces anon)
 * - SUPABASE_SECRET_KEY — server-only elevated access (`sb_secret_…`, replaces service_role)
 * - SUPABASE_SERVICE_ROLE_KEY — legacy JWT service_role (still supported)
 */

/** Project URL — prefer the public name so Vercel only needs one URL var. */
export function getSupabaseUrl(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim() ||
    undefined
  );
}

/**
 * Server-only elevated key (secret or legacy service_role). Bypasses RLS.
 * Never use the publishable key here — it cannot write with our RLS setup.
 */
export function getSupabaseSecretKey(): string | undefined {
  return (
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    undefined
  );
}

/** @deprecated Prefer getSupabaseSecretKey() */
export function getSupabaseServiceRoleKey(): string | undefined {
  return getSupabaseSecretKey();
}

/** Browser-safe publishable key (Supabase Dashboard → API → publishable). */
export function getSupabasePublishableKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    undefined
  );
}

export function isSupabaseServerConfigured(): boolean {
  return !!getSupabaseUrl() && !!getSupabaseSecretKey();
}

export function isSupabaseBrowserConfigured(): boolean {
  return !!getSupabaseUrl() && !!getSupabasePublishableKey();
}
