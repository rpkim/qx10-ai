/**
 * Admin authorization. Currently a static allowlist driven by the
 * `ADMIN_EMAILS` env var (comma-separated). Defaults include the
 * project owner so the system is bootstrappable out of the box.
 */

const DEFAULT_ADMINS = ['rpkim.jay@gmail.com'];

function parseAdmins(): string[] {
  const raw = process.env.ADMIN_EMAILS;
  const list = raw
    ? raw
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    : [];
  return Array.from(new Set([...list, ...DEFAULT_ADMINS.map((s) => s.toLowerCase())]));
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return parseAdmins().includes(email.trim().toLowerCase());
}

export function adminEmails(): string[] {
  return parseAdmins();
}
