import { NextResponse } from "next/server";
import { hashIdentityValue, normalizePhone } from "@/lib/onboarding/identity";
import {
  evaluateTrialEligibility,
  recordTrialUsage,
  type TrialOutcome,
} from "@/lib/onboarding/trialEligibility";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireSessionUser } from "@/lib/desktopAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SHOP_TABLE = "rb_shops";
const MEMBER_TABLE = "rb_shop_members";
const PROFILE_TABLE = "rb_profiles";
const EMPLOYEE_TABLE = "employees";
const TRIAL_DAYS = 30;
const OPTIONAL_SHOP_COLUMNS = [
  "billing_status",
  "trial_started_at",
  "trial_ends_at",
  "billing_current_period_end",
  "grace_ends_at",
  "stripe_customer_id",
  "stripe_subscription_id",
  "subscription_plan",
  "entitlement_override",
  "created_at",
  "updated_at",
  "website",
  "address1",
  "address2",
  "city",
  "state",
  "zip",
  "country",
  "machines_count",
  "employees_count",
  "departments",
  "trial_device_id",
  "trial_email_hash",
  "trial_phone_hash",
  "trial_restricted",
  "trial_restriction_reason",
  "trial_consumed_at",
  "trial_eligibility_reason",
] as const;

function s(v: any) {
  return String(v ?? "").trim();
}
function sOrNull(v: any) {
  const x = s(v);
  return x ? x : null;
}
function nInt(v: any, def = 0, min = 0, max = 100000) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  const i = Math.trunc(n);
  if (i < min) return min;
  if (i > max) return max;
  return i;
}

function formatSbError(error: any) {
  if (!error) return "Unknown error";
  const msg = String(error.message ?? error ?? "");
  const code = error.code ? ` code=${String(error.code)}` : "";
  const details = error.details ? ` details=${String(error.details)}` : "";
  const hint = error.hint ? ` hint=${String(error.hint)}` : "";
  return `${msg}${code}${details}${hint}`;
}

function tryExtractMissingColumn(msg: string): string | null {
  const relationMatch = msg.match(/column\s+"([^"]+)"\s+of\s+relation/i);
  if (relationMatch?.[1]) return relationMatch[1];

  const schemaCacheMatch = msg.match(/could not find the\s+'([^']+)'\s+column/i);
  if (schemaCacheMatch?.[1]) return schemaCacheMatch[1];

  const qualifiedColumnMatch = msg.match(/column\s+([a-z0-9_]+\.){0,2}([a-z0-9_]+)\s+does not exist/i);
  if (qualifiedColumnMatch?.[2]) return qualifiedColumnMatch[2];

  return null;
}

function optionalSelectColumns(excluded: Set<string>) {
  return ["id", "name", "billing_status", "trial_started_at", "trial_ends_at", "trial_restricted", "trial_restriction_reason", "trial_consumed_at", "trial_eligibility_reason"].filter(
    (col) => !excluded.has(col)
  );
}

function normalizeShopResult(row: Record<string, any>, fallback: Record<string, any>) {
  return {
    id: row.id,
    name: row.name ?? fallback.name,
    billing_status: row.billing_status ?? fallback.billing_status ?? "trialing",
    trial_started_at: row.trial_started_at ?? fallback.trial_started_at ?? null,
    trial_ends_at: row.trial_ends_at ?? fallback.trial_ends_at ?? null,
    trial_restricted: Boolean(row.trial_restricted ?? fallback.trial_restricted),
    trial_restriction_reason: row.trial_restriction_reason ?? fallback.trial_restriction_reason ?? null,
    trial_consumed_at: row.trial_consumed_at ?? fallback.trial_consumed_at ?? null,
    trial_eligibility_reason: row.trial_eligibility_reason ?? fallback.trial_eligibility_reason ?? null,
  };
}

function buildTrialMessage(outcome: TrialOutcome, signal?: string | null) {
  if (outcome === "billing_required") {
    return "This company was created successfully, but billing is required because this account, device, or verified contact information already has prior trial or billing history.";
  }

  if (outcome === "restricted_trial") {
    return `This company was created successfully, but a new clean trial was not granted because prior usage was detected${signal ? ` for ${signal.replace(/_/g, " ")}` : ""}.`;
  }

  return "Your company was created and a clean 30-day trial is active.";
}

function persistedBillingStatusForTrialOutcome(outcome: TrialOutcome): "trialing" | "expired" {
  return outcome === "clean_trial" ? "trialing" : "expired";
}

async function insertShopWithFallback(admin: any, payload: Record<string, any>) {
  const working = { ...payload };
  const excluded = new Set<string>();

  for (let attempt = 0; attempt < OPTIONAL_SHOP_COLUMNS.length + 3; attempt++) {
    const selectCols = optionalSelectColumns(excluded).join(",");
    const query = admin.from(SHOP_TABLE).insert(working);
    const { data, error } = selectCols
      ? await query.select(selectCols).single()
      : await query.select("id,name").single();

    if (!error && data) return normalizeShopResult(data, payload);

    const msg = formatSbError(error);
    const col = tryExtractMissingColumn(msg);
    if (col && (Object.prototype.hasOwnProperty.call(working, col) || OPTIONAL_SHOP_COLUMNS.includes(col as any) || excluded.has(col))) {
      delete working[col];
      excluded.add(col);
      continue;
    }

    throw new Error(`[${SHOP_TABLE}] ${msg}`);
  }

  throw new Error(`[${SHOP_TABLE}] Insert failed after stripping optional columns`);
}

async function serviceRolePreflight(admin: any, userId: string) {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data?.user?.id) {
    throw new Error(
      `supabaseAdmin is NOT service-role (auth.admin.getUserById failed). ` +
        `Check SUPABASE_SERVICE_ROLE_KEY in Vercel and /lib/supabase/admin wiring. ` +
        `Error: ${formatSbError(error)}`
    );
  }
}

async function createShop(admin: any, shopPayload: Record<string, any>) {
  return await insertShopWithFallback(admin, shopPayload);
}

async function createMembership(admin: any, shopId: string, userId: string) {
  const { error } = await admin.from(MEMBER_TABLE).insert({ shop_id: shopId, user_id: userId, role: "owner" });
  if (error) {
    throw new Error(`[${MEMBER_TABLE}] ${formatSbError(error)}`);
  }
}

function buildAdminEmployeeCode(userId: string) {
  const token = String(userId ?? "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase();
  return `ADM${token || "USER"}`;
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

  const employee = await insertWithFallback(admin, employeePayload);
  return employee?.id ?? null;
}

async function insertWithFallback(admin: any, payload: Record<string, any>) {
  let working = { ...payload };

  for (let attempt = 0; attempt < 16; attempt++) {
    const { data, error } = await admin.from(EMPLOYEE_TABLE).insert(working).select("id").single();
    if (!error) return data;

    const msg = formatSbError(error);
    const col = tryExtractMissingColumn(msg);
    if (col && Object.prototype.hasOwnProperty.call(working, col)) {
      delete working[col];
      continue;
    }

    throw new Error(`[${EMPLOYEE_TABLE}] ${msg}`);
  }

  throw new Error(`[${EMPLOYEE_TABLE}] Insert failed after stripping optional columns`);
}

export async function POST(req: Request) {
  try {
    const { user } = await requireSessionUser(req);
    const body = await req.json().catch(() => ({}));

    const first_name = s(body.first_name);
    const last_name = s(body.last_name);
    const company_name = s(body.company_name);
    const phone = normalizePhone(body.phone);
    const deviceId = sOrNull(body.device_id) ?? sOrNull(req.headers.get("x-runbook-device-id"));

    if (!first_name) return NextResponse.json({ ok: false, error: "first_name required" }, { status: 400 });
    if (!last_name) return NextResponse.json({ ok: false, error: "last_name required" }, { status: 400 });
    if (!company_name || company_name.length < 2) {
      return NextResponse.json({ ok: false, error: "company_name required" }, { status: 400 });
    }

    const admin = supabaseAdmin();
    await serviceRolePreflight(admin, user.id);

    try {
      const { error } = await admin.from(PROFILE_TABLE).upsert({
        id: user.id,
        first_name,
        last_name,
        phone: phone || null,
        email: user.email ?? null,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    } catch {
    }

    const now = new Date();
    const trialEnds = new Date(now.getTime());
    trialEnds.setUTCDate(trialEnds.getUTCDate() + TRIAL_DAYS);

    const emailHash = user.email ? hashIdentityValue(String(user.email).trim().toLowerCase()) : null;
    const phoneHash = phone ? hashIdentityValue(phone) : null;
    const eligibility = await evaluateTrialEligibility({
      userId: user.id,
      deviceId,
      emailHash,
      phoneHash,
    });

    const shopPayload: Record<string, any> = {
      name: company_name,
      website: sOrNull(body.website),
      address1: sOrNull(body.address1),
      address2: sOrNull(body.address2),
      city: sOrNull(body.city),
      state: sOrNull(body.state),
      zip: sOrNull(body.zip),
      country: sOrNull(body.country),
      machines_count: nInt(body.machines, 0),
      employees_count: nInt(body.employees, 0),
      departments: Array.isArray(body.departments) ? body.departments : [],
      billing_status: persistedBillingStatusForTrialOutcome(eligibility.outcome),
      trial_started_at: eligibility.outcome === "clean_trial" ? now.toISOString() : null,
      trial_ends_at: eligibility.outcome === "clean_trial" ? trialEnds.toISOString() : null,
      billing_current_period_end: null,
      grace_ends_at: null,
      stripe_customer_id: null,
      stripe_subscription_id: null,
      subscription_plan: null,
      entitlement_override: null,
      trial_device_id: deviceId,
      trial_email_hash: emailHash,
      trial_phone_hash: phoneHash,
      trial_restricted: eligibility.restrictedTrial,
      trial_restriction_reason: eligibility.restrictedTrial ? eligibility.eligibilityReason : null,
      trial_consumed_at: now.toISOString(),
      trial_eligibility_reason: eligibility.eligibilityReason,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };

    const shop = await createShop(admin, shopPayload);
    await createMembership(admin, shop.id, user.id);
    await ensureAdminEmployee(admin, {
      shopId: shop.id,
      userId: user.id,
      fullName: `${first_name} ${last_name}`.trim(),
      email: user.email ?? "",
      phone: phone ?? "",
      companyName: shop.name ?? company_name,
      sourceDeviceId: deviceId,
    });
    await recordTrialUsage({
      shopId: shop.id,
      shopName: shop.name,
      userId: user.id,
      deviceId,
      emailHash,
      phoneHash,
      outcome: eligibility.outcome,
      eligibilityReason: eligibility.eligibilityReason,
    });

    return NextResponse.json({
      ok: true,
      existing: false,
      shop_id: shop.id,
      shop_name: shop.name,
      billing_status: shop.billing_status,
      trial_started_at: shop.trial_started_at ?? (eligibility.outcome === "clean_trial" ? shopPayload.trial_started_at : null),
      trial_ends_at: shop.trial_ends_at ?? (eligibility.outcome === "clean_trial" ? shopPayload.trial_ends_at : null),
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
    const msg = String(e?.message ?? e);

    console.error("DESKTOP_BOOTSTRAP_ERROR:", msg);

    const status = /not authenticated/i.test(msg) ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
