import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { assertUuid } from "@/lib/authz";
import { requireSessionUser } from "@/lib/desktopAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  readBoundedExactJsonObject,
  SecurityJsonRequestError,
} from "@/lib/security/boundedJsonRequest";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";
import {
  ADMINISTRATIVE_COMPLETION_SCOPE,
  issueAdministrativeAuthorizationGrant,
  MAXIMUM_ADMINISTRATIVE_TARGET_ID,
} from "@/lib/administrativeAuthorizationGrant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ISSUE_REQUEST_SCHEMA = {
  authorization_id: "string",
  shop_id: "string",
  scope: "string",
  work_order_id: "number",
  operation_id: "number",
  reason: "string",
  password: "string",
} as const;

class AdministrativeMembershipError extends Error {
  readonly status: 403 | 503;

  constructor(status: 403 | 503) {
    super("Active owner or administrator authority could not be verified.");
    this.name = "AdministrativeMembershipError";
    this.status = status;
  }
}

function noStoreJson(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

function createPublicClient() {
  return createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

async function requireActiveAdministrativeMembership(
  admin: ReturnType<typeof supabaseAdmin>,
  shopId: string,
  userId: string,
): Promise<"owner" | "admin"> {
  const { data, error } = await admin
    .from("rb_shop_members")
    .select("id,role")
    .eq("shop_id", shopId)
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw new AdministrativeMembershipError(503);
  const role = String(data?.role ?? "").trim().toLowerCase();
  if (!data?.id || (role !== "owner" && role !== "admin")) {
    throw new AdministrativeMembershipError(403);
  }
  return role;
}

export async function POST(req: Request) {
  try {
    const { user } = await requireSessionUser(req);
    const body = await readBoundedExactJsonObject(req, ISSUE_REQUEST_SCHEMA);
    const authorizationId = body.authorization_id as string;
    const shopId = body.shop_id as string;
    const scope = body.scope as string;
    const workOrderId = body.work_order_id as number;
    const operationId = body.operation_id as number;
    const reason = (body.reason as string).trim();
    const password = body.password as string;
    assertUuid("authorization_id", authorizationId);
    assertUuid("shop_id", shopId);
    if (
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
      return noStoreJson({ ok: false, error: "The administrative completion scope is invalid." }, 400);
    }
    if (!password || password.length > 128 || !user.email) {
      return noStoreJson({ ok: false, error: "Fresh administrator credentials are required." }, 401);
    }

    const admin = supabaseAdmin();
    await requireActiveAdministrativeMembership(admin, shopId, user.id);

    // Defense in depth only: this bucket is process-local and resets across instances/restarts.
    // Production rollout must separately verify the deployed Supabase Auth sign-in rate limits.
    rateLimitOrThrow({
      key: `f03:administrative-authorization:${user.id.toLowerCase()}:${shopId.toLowerCase()}`,
      limit: 10,
      windowMs: 5 * 60_000,
    });

    const freshAuthentication = await createPublicClient().auth.signInWithPassword({
      email: user.email,
      password,
    });
    if (freshAuthentication.error?.status === 429) {
      return noStoreJson({ ok: false, error: "Administrative authorization is temporarily rate limited." }, 429);
    }
    if (
      freshAuthentication.error ||
      !freshAuthentication.data.user?.id ||
      freshAuthentication.data.user.id !== user.id
    ) {
      return noStoreJson({ ok: false, error: "Fresh administrator credentials were rejected." }, 401);
    }

    const role = await requireActiveAdministrativeMembership(admin, shopId, user.id);

    const issued = issueAdministrativeAuthorizationGrant(
      {
        authorizationId,
        shopId,
        workOrderId,
        operationId,
        reason,
      },
      {
        userId: user.id,
        role,
      },
    );

    return noStoreJson({
      ok: true,
      grant: issued.grant,
      expires_utc: issued.claims.expires_utc,
    });
  } catch (error: unknown) {
    if (error instanceof SecurityJsonRequestError) {
      return noStoreJson({ ok: false, error: "The administrative authorization request is invalid." }, error.status);
    }
    if (error instanceof AdministrativeMembershipError) {
      return noStoreJson(
        {
          ok: false,
          error:
            error.status === 503
              ? "Administrative authority could not be verified."
              : "Active owner or administrator authority is required.",
        },
        error.status,
      );
    }
    const message = error instanceof Error ? error.message : String(error);
    const status = /not authenticated/i.test(message)
      ? 401
      : /rate limit exceeded/i.test(message)
        ? 429
        : /must be a uuid|uuid is invalid/i.test(message)
          ? 400
          : /signing is not configured/i.test(message)
            ? 503
            : 500;
    return noStoreJson(
      {
        ok: false,
        error:
          status === 401
            ? "Not authenticated"
            : status === 429
              ? "Administrative authorization is temporarily rate limited."
              : "Administrative authority could not be verified.",
      },
      status,
    );
  }
}
