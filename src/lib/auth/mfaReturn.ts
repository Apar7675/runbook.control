export const CONTROL_REQUEST_PATH_HEADER = "x-rb-control-request-path";
const FALLBACK = "/dashboard";
const LOCAL_ORIGIN = "https://control.invalid";
const CONTROL_ROOTS = new Set([
  "dashboard", "shops", "devices", "workstations", "people", "mobile-access",
  "timeclock-review", "billing-access", "support", "software-updates", "updates",
  "audit", "settings", "apps", "status",
]);

/** Return only a local Control page, never an auth/API destination or external URL. */
export function safeMfaReturnTo(value: unknown): string {
  if (typeof value !== "string" || value.length > 4096 ||
      !value.startsWith("/") || value.startsWith("//") ||
      /[\\\u0000-\u001f\u007f]/.test(value)) return FALLBACK;
  try {
    const target = new URL(value, LOCAL_ORIGIN);
    const path = decodeURIComponent(target.pathname);
    if (target.origin !== LOCAL_ORIGIN || path.startsWith("//") ||
        /[\\\u0000-\u001f\u007f]/.test(path) ||
        !CONTROL_ROOTS.has(path.split("/")[1])) return FALLBACK;
    return target.pathname + target.search + target.hash;
  } catch {
    return FALLBACK;
  }
}

export function mfaStepUpHref(returnTo: unknown): string {
  return "/mfa?next=" + encodeURIComponent(safeMfaReturnTo(returnTo));
}

export function mfaReturnFromRequestPath(requestPath: unknown): string {
  if (typeof requestPath !== "string" || !requestPath.startsWith("/") ||
      requestPath.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(requestPath)) return FALLBACK;
  try {
    const target = new URL(requestPath, LOCAL_ORIGIN);
    if (target.origin !== LOCAL_ORIGIN || target.pathname !== "/mfa") return FALLBACK;
    return safeMfaReturnTo(target.searchParams.get("next"));
  } catch {
    return FALLBACK;
  }
}
