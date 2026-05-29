/** Server-side Supabase project URL (falls back to NEXT_PUBLIC_SUPABASE_URL). */
export function getSupabaseUrl(): string | undefined {
  return (
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    undefined
  );
}

/** Server-only — full DB access via service role. Never expose to the browser. */
export function getSupabaseServiceRoleKey(): string | undefined {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || undefined;
}

/** Browser-safe publishable key (Supabase Dashboard → API → publishable key). */
export function getSupabasePublishableKey(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || undefined;
}

export function isSupabaseServerConfigured(): boolean {
  return !!getSupabaseUrl() && !!getSupabaseServiceRoleKey();
}

export function isSupabaseBrowserConfigured(): boolean {
  return !!getSupabaseUrl() && !!getSupabasePublishableKey();
}
