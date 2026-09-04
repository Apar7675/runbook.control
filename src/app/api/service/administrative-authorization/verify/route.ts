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

    return noStoreJson({
      ok: true,
      authorization_id: claims.authorization_id,
      shop_id: claims.shop_id,
      scope: claims.scope,
      work_order_id: claims.work_order_id,
      operation_id: claims.operation_id,
      reason,
      user_id: claims.user_id,
      role: claims.role,
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
    const message = error instanceof Error ? error.message : String(error);
    const status = /signing is not configured/i.test(message)
      ? 503
      : /uuid|invalid|signature|expired|match/i.test(message)
        ? 403
        : 500;
    return noStoreJson(
      {
        ok: false,
        error:
          status === 503
            ? "Administrative authorization verification is unavailable."
            : "Administrative authorization grant was rejected.",
      },
      status,
    );
  }
}
