/**
 * Platform admin helpers.
 *
 * This exists because some pages import `isPlatformAdminEmail`.
 * Your real admin check (rb_control_admins table) is the authoritative one,
 * but this is still useful for bootstrapping / emergency access.
 */

function parseCsv(raw: string): string[] {
  return String(raw ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Returns true if the given email is in RUNBOOK_PLATFORM_ADMIN_EMAILS (comma-separated).
 * Example:
 *   RUNBOOK_PLATFORM_ADMIN_EMAILS=you@domain.com,other@domain.com
 */
export function isPlatformAdminEmail(email: string | null | undefined): boolean {
  const e = String(email ?? "").trim().toLowerCase();
  if (!e) return false;

  const allow = parseCsv(process.env.RUNBOOK_PLATFORM_ADMIN_EMAILS ?? "");
  return allow.includes(e);
}

/**
 * Optional: returns the normalized allowlist for diagnostics.
 */
export function getPlatformAdminEmails(): string[] {
  return parseCsv(process.env.RUNBOOK_PLATFORM_ADMIN_EMAILS ?? "");
}
