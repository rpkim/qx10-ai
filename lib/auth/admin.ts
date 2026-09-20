/**
 * Admin authorization. Static allowlist driven entirely by the
 * `ADMIN_EMAILS` env var (comma-separated) — no default admin is baked
 * into the source, since this repo is public. Set `ADMIN_EMAILS` in every
 * environment that needs `/admin` access.
 */

function parseAdmins(): string[] {
  const raw = process.env.ADMIN_EMAILS;
  const list = raw
    ? raw
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    : [];
  return Array.from(new Set(list));
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return parseAdmins().includes(email.trim().toLowerCase());
}

export function adminEmails(): string[] {
  return parseAdmins();
}
