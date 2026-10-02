import { NextResponse } from "next/server";
import { assertUuid } from "@/lib/authz";
import {
  readBoundedExactJsonObject,
  SecurityJsonRequestError,
} from "@/lib/security/boundedJsonRequest";
import {
  ADMINISTRATIVE_COMPLETION_SCOPE,
  MAXIMUM_ADMINISTRATIVE_TARGET_ID,
  verifyAdministrativeAuthorizationGrant,
} from "@/lib/administrativeAuthorizationGrant";
import {
  AdministrativeCompletionAuthorityError,
  requireCanonicalAdministrativeUuid,
  resolveAdministrativeCompletionAuthority,
} from "@/lib/administrativeCompletionAuthority";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VERIFY_REQUEST_SCHEMA = {
  grant: "string",
  authorization_id: "string",
  shop_id: "string",
  scope: "string",
  work_order_id: "number",
  operation_id: "number",
  reason: "string",
} as const;

function noStoreJson(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

export async function POST(req: Request) {
  try {
    const body = await readBoundedExactJsonObject(req, VERIFY_REQUEST_SCHEMA);
    const grant = body.grant as string;
    const authorizationId = body.authorization_id as string;
    const shopId = body.shop_id as string;
    const scope = body.scope as string;
    const workOrderId = body.work_order_id as number;
    const operationId = body.operation_id as number;
    const reason = (body.reason as string).trim();

    assertUuid("authorization_id", authorizationId);
    assertUuid("shop_id", shopId);
    requireCanonicalAdministrativeUuid("authorization_id", authorizationId);
    requireCanonicalAdministrativeUuid("shop_id", shopId);
    if (
      grant.length === 0 ||
      grant.length > 4096 ||
      scope !== ADMINISTRATIVE_COMPLETION_SCOPE ||
      !Number.isSafeInteger(workOrderId) ||
      workOrderId <= 0 ||
      workOrderId > MAXIMUM_ADMINISTRATIVE_TARGET_ID ||
      !Number.isSafeInteger(operationId) ||
      operationId <= 0 ||
      operationId > MAXIMUM_ADMINISTRATIVE_TARGET_ID ||
      reason.length < 8 ||
      reason.length > 1000
    ) {
      return noStoreJson({ ok: false, error: "The administrative authorization grant request is invalid." }, 400);
    }

    const claims = verifyAdministrativeAuthorizationGrant(grant, {
      authorizationId,
      shopId,
      workOrderId,
      operationId,
      reason,
    });
    const currentAuthority = await resolveAdministrativeCompletionAuthority(
      supabaseAdmin(),
      claims.shop_id,
      claims.user_id,
    );
    if (
      currentAuthority.employeeId !== claims.employee_id ||
      currentAuthority.role !== claims.role
    ) {
      throw new AdministrativeCompletionAuthorityError(403, "ADMINISTRATIVE_SIGNED_IDENTITY_STALE");
    }

    return noStoreJson({
      ok: true,
      authorization_id: claims.authorization_id,
      shop_id: claims.shop_id,
      scope: claims.scope,
      work_order_id: claims.work_order_id,
      operation_id: claims.operation_id,
      reason,
      user_id: claims.user_id,
      employee_id: claims.employee_id,
      role: claims.role,
      capability_code: claims.capability_code,
      capability_version: claims.capability_version,
      action: claims.action,
      authenticated_utc: claims.authenticated_utc,
      expires_utc: claims.expires_utc,
    });
  } catch (error: unknown) {
    if (error instanceof SecurityJsonRequestError) {
      return noStoreJson(
        { ok: false, error: "The administrative authorization grant request is invalid." },
        error.status,
      );
    }
    if (error instanceof AdministrativeCompletionAuthorityError) {
      return noStoreJson(
        {
          ok: false,
          error:
            error.status === 503
              ? "Administrative authorization verification is unavailable."
              : "Administrative authorization grant was rejected.",
        },
        error.status,
      );
    }
    const message = error instanceof Error ? error.message : String(error);
    const status = /signing is not configured/i.test(message)
      ? 503
      : /must be a uuid|canonical uuid/i.test(message)
        ? 400
        : /invalid|signature|expired|match/i.test(message)
          ? 403
          : 500;
    return noStoreJson(
      {
        ok: false,
        error:
          status === 503
            ? "Administrative authorization verification is unavailable."
            : status === 400
              ? "The administrative authorization grant request is invalid."
              : "Administrative authorization grant was rejected.",
      },
      status,
    );
  }
}
