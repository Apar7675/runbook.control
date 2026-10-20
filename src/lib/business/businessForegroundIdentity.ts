import { randomUUID } from "node:crypto";
import { requireSessionUser } from "@/lib/desktopAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { bindVerifiedControlSession, BusinessAuthorizationError, requireBusinessUuid,
  type VerifiedControlSession } from "./directoryAuthorization";

export const BUSINESS_FOREGROUND_PROJECTION = "business-foreground-v1";
const MAX_LIFETIME_MS = 30_000;
type Status = 400 | 401 | 403 | 503;
export class BusinessForegroundMetadataError extends Error {
  constructor(readonly status: Status, readonly code: string) { super("Foreground identity is unavailable."); }
}
function deny(status: Status, code: string): never { throw new BusinessForegroundMetadataError(status, code); }
function uuid(value: unknown): string {
  try { return requireBusinessUuid(value); } catch { return deny(400, "INVALID_ID"); }
}
function exact(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return deny(503, "INVALID_METADATA");
  const row = value as Record<string, unknown>;
  if (Object.keys(row).sort().join(",") !== [...keys].sort().join(",")) return deny(503, "INVALID_METADATA");
  return row;
}
export type BusinessForegroundMetadataReceipt = {
  ok: true; contract: typeof BUSINESS_FOREGROUND_PROJECTION; auth_mode: "user";
  request_id: string; snapshot_id: string; user_id: string; session_id: string; shop_id: string;
  session_expires_utc: string; issued_utc: string; expires_utc: string;
  employee: { id: string; shop_id: string; auth_user_id: string; is_active: true;
    runbook_access_enabled: true; workstation_access_enabled: true };
};

// Pure projection only: callers cannot turn this into operation authority. The production handler
// below obtains principal from real requireSessionUser followed by the EXISTING V5 token binder.
// No names, email, employee_code, role/default-role, SSN, PIN hash, device secret or capability fields.
export function projectBusinessForegroundMetadata(input: {
  principal: VerifiedControlSession; shopId: string; requestId: string; snapshotId: string;
  memberships: unknown; employees: unknown; nowMs: number;
}): BusinessForegroundMetadataReceipt {
  const { principal: p, nowMs: now } = input;
  const shop = uuid(input.shopId), request = uuid(input.requestId), snapshot = uuid(input.snapshotId);
  uuid(p.user_id); uuid(p.session_id);
  if (!Number.isSafeInteger(now) || !Number.isSafeInteger(p.expires_ms) ||
      p.expires_ms <= now || p.expires_ms > 253402300799000) return deny(401, "SESSION_EXPIRED");
  if (!Array.isArray(input.memberships) || input.memberships.length !== 1) return deny(403, "MEMBERSHIP_DENIED");
  const member = exact(input.memberships[0], ["shop_id", "user_id", "is_active"]);
  if (member.shop_id !== shop || member.user_id !== p.user_id || member.is_active !== true)
    return deny(403, "MEMBERSHIP_DENIED");
  // Query returns at most two ACTIVE links for this exact subject/shop; two proves ambiguity.
  if (!Array.isArray(input.employees) || input.employees.length !== 1) return deny(403, "EMPLOYEE_LINK_DENIED");
  const employee = exact(input.employees[0], ["id", "shop_id", "auth_user_id", "is_active",
    "runbook_access_enabled", "workstation_access_enabled"]);
  const employeeId = uuid(employee.id);
  if (employee.shop_id !== shop || employee.auth_user_id !== p.user_id || employee.is_active !== true ||
      employee.runbook_access_enabled !== true || employee.workstation_access_enabled !== true)
    return deny(403, "EMPLOYEE_LINK_DENIED");
  const expires = Math.min(now + MAX_LIFETIME_MS, p.expires_ms);
  return { ok: true, contract: BUSINESS_FOREGROUND_PROJECTION, auth_mode: "user",
    request_id: request, snapshot_id: snapshot, user_id: p.user_id, session_id: p.session_id, shop_id: shop,
    session_expires_utc: new Date(p.expires_ms).toISOString(), issued_utc: new Date(now).toISOString(),
    expires_utc: new Date(expires).toISOString(), employee: { id: employeeId, shop_id: shop,
      auth_user_id: p.user_id, is_active: true, runbook_access_enabled: true, workstation_access_enabled: true } };
}
function response(body: object, status: number): Response {
  return Response.json(body, { status, headers: {
    "Cache-Control": "no-store, max-age=0", "Pragma": "no-cache", "Vary": "Authorization" } });
}

// Narrow branch for the EXISTING employee-directory GET route. No route is installed by this packet.
// This function does not call authorizeDesktop, local-dev fallback, admin-completion or legacy rows.
export async function businessForegroundMetadata(req: Request,
  admin: ReturnType<typeof supabaseAdmin>): Promise<Response> {
  try {
    const url = new URL(req.url);
    if (req.method !== "GET" || url.searchParams.get("projection") !== BUSINESS_FOREGROUND_PROJECTION ||
        url.searchParams.getAll("shop_id").length !== 1 || url.searchParams.getAll("request_id").length !== 1 ||
        url.searchParams.getAll("projection").length !== 1)
      return deny(400, "INVALID_REQUEST");
    const shopId = uuid(url.searchParams.get("shop_id")), requestId = uuid(url.searchParams.get("request_id"));
    let authenticated: Awaited<ReturnType<typeof requireSessionUser>>;
    try { authenticated = await requireSessionUser(req); } // Auth.getUser verifies THIS exact bearer.
    catch (error) {
      if (error instanceof Error && error.message === "Not authenticated") return deny(401, "SIGN_IN_REQUIRED");
      return deny(503, "SESSION_VERIFICATION_UNAVAILABLE");
    }
    if (authenticated.user.is_anonymous === true) return deny(401, "ANONYMOUS_SESSION");
    let principal: VerifiedControlSession;
    try {
      principal = bindVerifiedControlSession(authenticated.accessToken, authenticated.user.id, Date.now());
    } catch (error) {
      if (error instanceof BusinessAuthorizationError && error.status === 401) return deny(401, "INVALID_SESSION");
      return deny(503, "SESSION_CONTEXT_UNAVAILABLE");
    }
    // Token-authenticated receipt, NOT an auth.sessions revocation proof. V5 action SQL still performs
    // the authoritative current-session/capability check. A receipt is never usable as a grant.
    const membership = await admin.from("rb_shop_members").select("shop_id,user_id,is_active")
      .eq("shop_id", shopId).eq("user_id", principal.user_id).eq("is_active", true).limit(2);
    if (membership.error) return deny(503, "MEMBERSHIP_UNAVAILABLE");
    const employees = await admin.from("employees")
      .select("id,shop_id,auth_user_id,is_active,runbook_access_enabled,workstation_access_enabled")
      .eq("shop_id", shopId).eq("auth_user_id", principal.user_id).eq("is_active", true).limit(2);
    if (employees.error) return deny(503, "EMPLOYEE_METADATA_UNAVAILABLE");
    const receipt = projectBusinessForegroundMetadata({ principal, shopId, requestId, snapshotId: randomUUID(),
      memberships: membership.data, employees: employees.data, nowMs: Date.now() });
    return response(receipt, 200);
  } catch (error) {
    const failure = error instanceof BusinessForegroundMetadataError ? error :
      new BusinessForegroundMetadataError(503, "METADATA_UNAVAILABLE");
    return response({ ok: false, error: failure.code }, failure.status);
  }
}
