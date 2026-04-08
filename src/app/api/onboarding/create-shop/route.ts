import { NextResponse } from "next/server";
import { hashIdentityValue } from "@/lib/onboarding/identity";
import { getOnboardingState, upsertOnboardingState } from "@/lib/onboarding/state";
import { resolveOnboardingPath } from "@/lib/onboarding/flow";
import {
  deriveTrialOutcome,
  evaluateTrialEligibility,
  recordTrialUsage,
  type TrialOutcome,
} from "@/lib/onboarding/trialEligibility";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SHOP_TABLE = "rb_shops";
const MEMBER_TABLE = "rb_shop_members";
const TRIAL_DAYS = 30;
const EMPLOYEE_TABLE = "employees";

function s(v: any) {
  return String(v ?? "").trim();
}

function sOrNull(v: any) {
  const text = s(v);
  return text ? text : null;
}

function formatSbError(error: any) {
  if (!error) return "Unknown error";
  const msg = String(error.message ?? error ?? "");
  const code = error.code ? ` code=${String(error.code)}` : "";
  const details = error.details ? ` details=${String(error.details)}` : "";
  const hint = error.hint ? ` hint=${String(error.hint)}` : "";
  return `${msg}${code}${details}${hint}`;
}

function tryExtractMissingColumn(msg: string) {
  const match = msg.match(/column\s+"([^"]+)"\s+of\s+relation/i);
  return match?.[1] ?? null;
}

async function insertWithAutoStrip(admin: any, table: string, payload: Record<string, any>, selectCols: string) {
  let working: Record<string, any> = { ...payload };

  for (let attempt = 0; attempt < 16; attempt++) {
    const { data, error } = await admin.from(table).insert(working).select(selectCols).single();
    if (!error) return data;

    const msg = formatSbError(error);
    const missingColumn = tryExtractMissingColumn(msg);
    if (missingColumn && Object.prototype.hasOwnProperty.call(working, missingColumn)) {
      delete working[missingColumn];
      continue;
    }

    throw new Error(`[${table}] ${msg}`);
  }

  throw new Error(`[${table}] Insert failed after stripping columns.`);
}

async function loadExistingShop(admin: any, shopId: string) {
  const { data, error } = await admin
    .from(SHOP_TABLE)
    .select(
      "id,name,billing_status,trial_started_at,trial_ends_at,trial_restricted,trial_restriction_reason,trial_consumed_at,trial_eligibility_reason"
    )
    .eq("id", shopId)
    .maybeSingle();

  if (error) {
    throw new Error(`[${SHOP_TABLE}] ${formatSbError(error)}`);
  }

  return data ?? null;
}

function buildAdminEmployeeCode(userId: string) {
  const token = String(userId ?? "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase();
  return `ADM${token || "USER"}`;
}

function buildTrialMessage(outcome: TrialOutcome, signal?: string | null) {
  if (outcome === "billing_required") {
    return "Shop created. Billing is required because this account, device, or verified contact information has prior trial or billing history.";
  }

  if (outcome === "restricted_trial") {
    return `Shop created. A new clean trial was not granted because prior usage was detected${signal ? ` for ${signal.replace(/_/g, " ")}` : ""}.`;
  }

  return "Shop created. Your trial is ready.";
}

function persistedBillingStatusForTrialOutcome(outcome: TrialOutcome): "trialing" | "expired" {
  return outcome === "clean_trial" ? "trialing" : "expired";
}

async function ensureAdminEmployee(
  admin: any,
  input: {
    shopId: string;
    userId: string;
    fullName: string;
    email: string;
    phone: string;
    companyName: string;
    sourceDeviceId: string | null;
  }
) {
  const displayName = s(input.fullName) || "Shop Admin";
  const employeePayload = {
    shop_id: input.shopId,
    auth_user_id: input.userId,
    employee_code: buildAdminEmployeeCode(input.userId),
    display_name: displayName,
    full_name: displayName,
    preferred_name: displayName,
    username: s(input.email).split("@")[0] || "admin",
    email: s(input.email).toLowerCase(),
    phone: s(input.phone),
    company_name: s(input.companyName),
    role: "foreman",
    status: "Active",
    is_active: true,
    runbook_access_enabled: true,
    mobile_access_enabled: true,
    workstation_access_enabled: false,
    can_dashboard: true,
    can_work_orders: true,
    can_messaging: true,
    can_settings: true,
    source_device_id: input.sourceDeviceId ?? "",
  };

  const { data: existingEmployee, error: lookupError } = await admin
    .from(EMPLOYEE_TABLE)
    .select("id")
    .eq("shop_id", input.shopId)
    .eq("auth_user_id", input.userId)
    .maybeSingle();

  if (lookupError) {
    throw new Error(`[${EMPLOYEE_TABLE}] ${formatSbError(lookupError)}`);
  }

  if (existingEmployee?.id) {
    const { error: updateError } = await admin.from(EMPLOYEE_TABLE).update(employeePayload).eq("id", existingEmployee.id);
    if (updateError) {
      throw new Error(`[${EMPLOYEE_TABLE}] ${formatSbError(updateError)}`);
    }
    return existingEmployee.id;
  }

  const employee = await insertWithAutoStrip(admin, EMPLOYEE_TABLE, employeePayload, "id");
  return employee?.id ?? null;
}

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    rateLimitOrThrow({ key: `onboarding:create_shop:ip:${ip}`, limit: 12, windowMs: 60_000 });

    const body = await req.json().catch(() => ({}));
    const requestedName = s((body as any)?.name);

    const supabase = await supabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    const stateBefore = await getOnboardingState(user.id);
    if (!stateBefore) {
      return NextResponse.json({ ok: false, error: "Complete your profile and verification first." }, { status: 400 });
    }

    const shopName = requestedName || stateBefore.shop_name;
    if (requestedName && requestedName !== stateBefore.shop_name) {
      await upsertOnboardingState(user.id, { shop_name: requestedName });
    }

    const state = (await getOnboardingState(user.id)) ?? stateBefore;
    const resolvedPath = await resolveOnboardingPath(state);
    if (process.env.NODE_ENV === "development") {
      console.log("[Onboarding]", {
        action: "create_shop:start",
        state,
        result: { resolvedPath, requestedName },
      });
    }

    if (!shopName || shopName.length < 2) {
      return NextResponse.json({ ok: false, error: "Shop name is too short." }, { status: 400 });
    }
    if (!state.full_name || !state.email || !state.phone) {
      return NextResponse.json({ ok: false, error: "Complete your profile before creating a shop." }, { status: 400 });
    }
    if (!state.email_verified || !state.phone_verified) {
      return NextResponse.json(
        {
          ok: false,
          error: "Verify both email and phone before continuing.",
          reason: "verification_incomplete",
        },
        { status: 400 }
      );
    }

    const admin = supabaseAdmin();

    if (state.shop_id) {
      const existingShop = await loadExistingShop(admin, state.shop_id);
      if (existingShop) {
        await ensureAdminEmployee(admin, {
          shopId: existingShop.id,
          userId: user.id,
          fullName: state.full_name,
          email: state.email,
          phone: state.phone,
          companyName: existingShop.name ?? shopName,
          sourceDeviceId: state.device_id ?? null,
        });
        const trialOutcome = deriveTrialOutcome({
          billingStatus: existingShop.billing_status,
          trialRestricted: existingShop.trial_restricted,
          trialEligibilityReason: existingShop.trial_eligibility_reason ?? existingShop.trial_restriction_reason,
        });
        if (process.env.NODE_ENV === "development") {
          console.log("[Onboarding]", {
            action: "create_shop:idempotent_existing_shop",
            state,
            result: existingShop,
          });
        }
        return NextResponse.json({
          ok: true,
          existing: true,
          shop_id: existingShop.id,
          name: existingShop.name,
          billing_status: existingShop.billing_status,
          trial_started_at: existingShop.trial_started_at,
          trial_ends_at: existingShop.trial_ends_at,
          trial_restricted: Boolean(existingShop.trial_restricted),
          trial_restriction_reason: existingShop.trial_restriction_reason ?? null,
          trial_eligibility_reason: existingShop.trial_eligibility_reason ?? existingShop.trial_restriction_reason ?? null,
          billing_required: trialOutcome === "billing_required",
          trial_outcome: trialOutcome,
          trial_consumed_at: existingShop.trial_consumed_at ?? null,
          trial_signals_used: [],
          message:
            resolvedPath === "/onboarding/complete"
              ? "This shop is already set up."
              : "Your shop is already created. Resume onboarding from where you left off.",
        });
      }
    }

    const now = new Date();
    const trialEnds = new Date(now.getTime());
    trialEnds.setUTCDate(trialEnds.getUTCDate() + TRIAL_DAYS);

    const trialEmailHash = hashIdentityValue(state.email);
    const trialPhoneHash = hashIdentityValue(state.phone);
    const trialDeviceId = state.device_id ?? sOrNull(req.headers.get("x-runbook-device-id")) ?? null;

    const eligibility = await evaluateTrialEligibility({
      userId: user.id,
      deviceId: trialDeviceId,
      emailHash: trialEmailHash,
      phoneHash: trialPhoneHash,
    });

    const shop = await insertWithAutoStrip(
      admin,
      SHOP_TABLE,
      {
        name: shopName,
        website: sOrNull((body as any)?.website),
        billing_status: persistedBillingStatusForTrialOutcome(eligibility.outcome),
        trial_started_at: eligibility.outcome === "clean_trial" ? now.toISOString() : null,
        trial_ends_at: eligibility.outcome === "clean_trial" ? trialEnds.toISOString() : null,
        billing_current_period_end: null,
        grace_ends_at: null,
        stripe_customer_id: null,
        stripe_subscription_id: null,
        subscription_plan: null,
        entitlement_override: null,
        trial_device_id: trialDeviceId,
        trial_email_hash: trialEmailHash,
        trial_phone_hash: trialPhoneHash,
        trial_restricted: eligibility.restrictedTrial,
        trial_restriction_reason: eligibility.restrictedTrial ? eligibility.eligibilityReason : null,
        trial_consumed_at: now.toISOString(),
        trial_eligibility_reason: eligibility.eligibilityReason,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      "id,name,billing_status,trial_started_at,trial_ends_at,trial_restricted,trial_restriction_reason,trial_consumed_at,trial_eligibility_reason"
    );

    await insertWithAutoStrip(
      admin,
      MEMBER_TABLE,
      {
        shop_id: shop.id,
        user_id: user.id,
        role: "admin",
      },
      "shop_id,user_id,role"
    );

    await ensureAdminEmployee(admin, {
      shopId: shop.id,
      userId: user.id,
      fullName: state.full_name,
      email: state.email,
      phone: state.phone,
      companyName: shop.name ?? shopName,
      sourceDeviceId: trialDeviceId,
    });

    await recordTrialUsage({
      shopId: shop.id,
      shopName: shop.name ?? shopName,
      userId: user.id,
      deviceId: trialDeviceId,
      emailHash: trialEmailHash,
      phoneHash: trialPhoneHash,
      outcome: eligibility.outcome,
      eligibilityReason: eligibility.eligibilityReason,
    });

    await upsertOnboardingState(user.id, {
      shop_id: shop.id,
      shop_name: shop.name ?? shopName,
      completed_at: null,
    });

    if (process.env.NODE_ENV === "development") {
      console.log("[Onboarding]", {
        action: "create_shop:created",
        state,
        result: { shop_id: shop.id, eligibility },
      });
    }

    return NextResponse.json({
      ok: true,
      shop_id: shop.id,
      name: shop.name,
      billing_status: shop.billing_status ?? persistedBillingStatusForTrialOutcome(eligibility.outcome),
      trial_started_at: shop.trial_started_at ?? (eligibility.outcome === "clean_trial" ? now.toISOString() : null),
      trial_ends_at: shop.trial_ends_at ?? (eligibility.outcome === "clean_trial" ? trialEnds.toISOString() : null),
      trial_restricted: Boolean(shop.trial_restricted ?? eligibility.restrictedTrial),
      trial_restriction_reason: shop.trial_restriction_reason ?? (eligibility.restrictedTrial ? eligibility.eligibilityReason : null),
      trial_eligibility_reason: shop.trial_eligibility_reason ?? eligibility.eligibilityReason,
      trial_consumed_at: shop.trial_consumed_at ?? now.toISOString(),
      billing_required: eligibility.billingRequired,
      trial_outcome: eligibility.outcome,
      trial_signals_used: eligibility.signals,
      message: buildTrialMessage(eligibility.outcome, eligibility.primarySignal),
      shop_table: SHOP_TABLE,
      membership_table: MEMBER_TABLE,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Server error" }, { status: 500 });
  }
}
