import { NextResponse } from "next/server";
import { requireAal2 } from "@/lib/authz";
import {
  ADMINISTRATIVE_COMPLETION_CAPABILITY_CODE,
  ADMINISTRATIVE_COMPLETION_CAPABILITY_VERSION,
  requireCanonicalAdministrativeUuid,
} from "@/lib/administrativeCompletionAuthority";
import {
  readBoundedExactJsonObject,
  SecurityJsonRequestError,
} from "@/lib/security/boundedJsonRequest";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ASSIGNMENT_REQUEST_SCHEMA = {
  shop_id: "string",
  employee_id: "string",
  enabled: "boolean",
} as const;

function noStoreJson(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

class AdministrativeCompletionAssignmentError extends Error {
  readonly status: 403 | 404 | 409 | 503;

  constructor(status: 403 | 404 | 409 | 503) {
    super("Administrative completion capability assignment failed.");
    this.name = "AdministrativeCompletionAssignmentError";
    this.status = status;
  }
}

function statusForRpcError(code: unknown): 403 | 404 | 409 | 503 {
  const normalized = String(code ?? "").trim().toUpperCase();
  if (normalized === "42501") return 403;
  if (normalized === "P0002") return 404;
  if (normalized === "22023" || normalized === "23505" || normalized === "21000") return 409;
  return 503;
}

export async function POST(req: Request) {
  try {
    const body = await readBoundedExactJsonObject(req, ASSIGNMENT_REQUEST_SCHEMA);
    const shopId = requireCanonicalAdministrativeUuid("shop_id", body.shop_id);
    const employeeId = requireCanonicalAdministrativeUuid("employee_id", body.employee_id);
    const enabled = body.enabled as boolean;

    const { user } = await requireAal2();
    const actorUserId = requireCanonicalAdministrativeUuid("actor_user_id", user.id);

    rateLimitOrThrow({
      key: `admin:users:administrative-completion:${actorUserId}:${shopId}`,
      limit: 30,
      windowMs: 60_000,
    });

    const { data, error } = await supabaseAdmin().rpc(
      "rb_set_administrative_completion_capability",
      {
        p_shop_id: shopId,
        p_employee_id: employeeId,
        p_actor_user_id: actorUserId,
        p_enabled: enabled,
      },
    );
    if (error) {
      throw new AdministrativeCompletionAssignmentError(statusForRpcError(error.code));
    }

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new AdministrativeCompletionAssignmentError(503);
    }
    const result = data as Record<string, unknown>;
    if (
      result.employee_id !== employeeId ||
      result.shop_id !== shopId ||
      result.capability_code !== ADMINISTRATIVE_COMPLETION_CAPABILITY_CODE ||
      result.capability_version !== ADMINISTRATIVE_COMPLETION_CAPABILITY_VERSION ||
      result.enabled !== enabled
    ) {
      throw new AdministrativeCompletionAssignmentError(503);
    }

    return noStoreJson({
      ok: true,
      employee: {
        id: employeeId,
        shop_id: shopId,
        capability_code: ADMINISTRATIVE_COMPLETION_CAPABILITY_CODE,
        capability_version: ADMINISTRATIVE_COMPLETION_CAPABILITY_VERSION,
        enabled,
      },
    });
  } catch (error: unknown) {
    if (error instanceof SecurityJsonRequestError) {
      return noStoreJson({ ok: false, error: "The capability assignment request is invalid." }, error.status);
    }
    if (error instanceof AdministrativeCompletionAssignmentError) {
      return noStoreJson(
        {
          ok: false,
          error:
            error.status === 503
              ? "Capability assignment is unavailable."
              : error.status === 404
                ? "The employee target was not found."
                : error.status === 409
                  ? "The employee is not eligible for this capability."
                  : "Active owner or administrator authority is required.",
        },
        error.status,
      );
    }
    const message = error instanceof Error ? error.message : String(error);
    const status = /not authenticated/i.test(message)
      ? 401
      : /mfa required|access denied/i.test(message)
        ? 403
        : /canonical uuid/i.test(message)
          ? 400
          : /rate limit exceeded/i.test(message)
            ? 429
            : 503;
    return noStoreJson(
      {
        ok: false,
        error:
          status === 401
            ? "Not authenticated"
            : status === 403
              ? "AAL2 owner or administrator authority is required."
              : status === 429
                ? "Capability assignment is temporarily rate limited."
                : status === 400
                  ? "The capability assignment request is invalid."
                  : "Capability assignment is unavailable.",
      },
      status,
    );
  }
}
