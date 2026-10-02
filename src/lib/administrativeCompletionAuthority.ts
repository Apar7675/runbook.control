import type { supabaseAdmin } from "@/lib/supabase/admin";

export const ADMINISTRATIVE_COMPLETION_CAPABILITY_CODE = "work-order.complete-close.override";
export const ADMINISTRATIVE_COMPLETION_CAPABILITY_VERSION = 1;
export const ADMINISTRATIVE_COMPLETION_ACTION = "administrative-complete-close";
export const ADMINISTRATIVE_COMPLETION_DIRECTORY_CONTRACT_VERSION = 1;

const CANONICAL_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export type AdministrativeCompletionRole = "owner" | "admin";

export type AdministrativeCompletionAuthority = {
  membershipId: string;
  role: AdministrativeCompletionRole;
  userId: string;
  shopId: string;
  employeeId: string;
};

export class AdministrativeCompletionAuthorityError extends Error {
  readonly status: 403 | 503;
  readonly reasonCode: string;

  constructor(status: 403 | 503, reasonCode: string) {
    super(
      status === 503
        ? "Administrative completion authority could not be verified."
        : "Administrative completion authority is not available for this principal.",
    );
    this.name = "AdministrativeCompletionAuthorityError";
    this.status = status;
    this.reasonCode = reasonCode;
  }
}

export function isCanonicalAdministrativeUuid(value: unknown): value is string {
  return typeof value === "string" && CANONICAL_UUID_PATTERN.test(value);
}

export function requireCanonicalAdministrativeUuid(label: string, value: unknown) {
  if (!isCanonicalAdministrativeUuid(value)) {
    throw new Error(`${label} must be a canonical UUID.`);
  }
  return value;
}

function requireRows(
  result: { data?: unknown; error?: { message?: string } | null },
  unavailableCode: string,
) {
  if (result.error || !Array.isArray(result.data)) {
    throw new AdministrativeCompletionAuthorityError(503, unavailableCode);
  }
  return result.data as Record<string, unknown>[];
}

export async function resolveActiveAdministrativeMembership(
  admin: ReturnType<typeof supabaseAdmin>,
  shopIdValue: string,
  userIdValue: string,
) {
  const shopId = requireCanonicalAdministrativeUuid("shop_id", shopIdValue);
  const userId = requireCanonicalAdministrativeUuid("user_id", userIdValue);
  const result = await admin
    .from("rb_shop_members")
    .select("id,shop_id,user_id,role,is_active")
    .eq("shop_id", shopId)
    .eq("user_id", userId)
    .limit(2);
  const rows = requireRows(result, "ADMINISTRATIVE_MEMBERSHIP_UNAVAILABLE");

  if (rows.length !== 1) {
    throw new AdministrativeCompletionAuthorityError(
      403,
      rows.length === 0
        ? "ADMINISTRATIVE_MEMBERSHIP_MISSING"
        : "ADMINISTRATIVE_MEMBERSHIP_AMBIGUOUS",
    );
  }

  const row = rows[0];
  const membershipId = row.id;
  const rowShopId = row.shop_id;
  const rowUserId = row.user_id;
  const role = row.role;
  if (
    !isCanonicalAdministrativeUuid(membershipId) ||
    rowShopId !== shopId ||
    rowUserId !== userId ||
    row.is_active !== true ||
    (role !== "owner" && role !== "admin")
  ) {
    throw new AdministrativeCompletionAuthorityError(403, "ADMINISTRATIVE_MEMBERSHIP_INELIGIBLE");
  }

  return {
    membershipId,
    role,
    shopId,
    userId,
  } as const;
}

export async function resolveAdministrativeCompletionAuthority(
  admin: ReturnType<typeof supabaseAdmin>,
  shopIdValue: string,
  userIdValue: string,
): Promise<AdministrativeCompletionAuthority> {
  const membership = await resolveActiveAdministrativeMembership(admin, shopIdValue, userIdValue);
  const result = await admin
    .from("employees")
    .select("id,shop_id,auth_user_id,is_active,can_administrative_complete_close")
    .eq("shop_id", membership.shopId)
    .eq("auth_user_id", membership.userId)
    .limit(2);
  const rows = requireRows(result, "ADMINISTRATIVE_EMPLOYEE_MAPPING_UNAVAILABLE");

  if (rows.length !== 1) {
    throw new AdministrativeCompletionAuthorityError(
      403,
      rows.length === 0
        ? "ADMINISTRATIVE_EMPLOYEE_MAPPING_MISSING"
        : "ADMINISTRATIVE_EMPLOYEE_MAPPING_AMBIGUOUS",
    );
  }

  const row = rows[0];
  if (
    !isCanonicalAdministrativeUuid(row.id) ||
    row.shop_id !== membership.shopId ||
    row.auth_user_id !== membership.userId
  ) {
    throw new AdministrativeCompletionAuthorityError(403, "ADMINISTRATIVE_EMPLOYEE_MAPPING_INVALID");
  }
  if (row.is_active !== true) {
    throw new AdministrativeCompletionAuthorityError(403, "ADMINISTRATIVE_EMPLOYEE_INACTIVE");
  }
  if (row.can_administrative_complete_close !== true) {
    throw new AdministrativeCompletionAuthorityError(403, "ADMINISTRATIVE_COMPLETION_CAPABILITY_REQUIRED");
  }

  return {
    ...membership,
    employeeId: row.id,
  };
}

export function administrativeAuthorityIsStable(
  before: AdministrativeCompletionAuthority,
  after: AdministrativeCompletionAuthority,
) {
  return (
    before.membershipId === after.membershipId &&
    before.role === after.role &&
    before.userId === after.userId &&
    before.shopId === after.shopId &&
    before.employeeId === after.employeeId
  );
}
