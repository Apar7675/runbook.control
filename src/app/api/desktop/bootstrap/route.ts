import { NextResponse } from "next/server";
import { hashIdentityValue, normalizeEmail, normalizePhone } from "@/lib/onboarding/identity";
import { findTrialReuseRisk, getOnboardingState, upsertOnboardingState } from "@/lib/onboarding/state";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireSessionUser } from "@/lib/desktopAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SHOP_TABLE = "rb_shops";
const MEMBER_TABLE = "rb_shop_members";
const PROFILE_TABLE = "rb_profiles";
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
  return ["id", "name", "billing_status", "trial_started_at", "trial_ends_at"].filter((col) => !excluded.has(col));
}

function normalizeShopResult(row: Record<string, any>, fallback: Record<string, any>) {
  return {
    id: row.id,
    name: row.name ?? fallback.name,
    billing_status: row.billing_status ?? fallback.billing_status ?? "trialing",
    trial_started_at: row.trial_started_at ?? fallback.trial_started_at ?? null,
    trial_ends_at: row.trial_ends_at ?? fallback.trial_ends_at ?? null,
    trial_restricted: row.trial_restricted ?? fallback.trial_restricted ?? false,
    trial_restriction_reason: row.trial_restriction_reason ?? fallback.trial_restriction_reason ?? null,
  };
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

async function findExistingOwnedShop(admin: any, userId: string) {
  const { data, error } = await admin
    .from(MEMBER_TABLE)
    .select("shop_id,role")
    .eq("user_id", userId)
    .in("role", ["owner", "admin"])
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`[${MEMBER_TABLE}] ${formatSbError(error)}`);
  }

  return data?.shop_id ? String(data.shop_id) : null;
}

function duplicateTrialResponse(field: "email" | "phone" | "device_id") {
  const message =
    field === "email"
      ? "This email already has a RunBook trial. Sign in instead."
      : field === "phone"
      ? "This phone number has already been used for a RunBook trial. Sign in instead or contact RunBook support."
      : "This device has already been used for a RunBook trial. Sign in instead or contact RunBook support.";

  return NextResponse.json(
    {
      ok: false,
      error: message,
      error_code: `trial_duplicate_${field}`,
    },
    { status: 409 }
  );
}

function duplicateShopNameResponse() {
  return NextResponse.json(
    {
      ok: false,
      error: "This shop name already has a RunBook trial. Sign in instead or contact RunBook support.",
      error_code: "trial_duplicate_shop_name",
    },
    { status: 409 }
  );
}

async function findExistingShopByName(admin: any, shopName: string) {
  const { data, error } = await admin
    .from(SHOP_TABLE)
    .select("id")
    .ilike("name", shopName)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`[${SHOP_TABLE}] ${formatSbError(error)}`);
  }

  return data?.id ? String(data.id) : null;
}

async function loadShop(admin: any, shopId: string) {
  const excluded = new Set<string>();

  for (let attempt = 0; attempt < OPTIONAL_SHOP_COLUMNS.length + 3; attempt++) {
    const selectCols = optionalSelectColumns(excluded).join(",");
    const { data, error } = await admin
      .from(SHOP_TABLE)
      .select(selectCols || "id,name")
      .eq("id", shopId)
      .maybeSingle();

    if (!error) {
      return data ? normalizeShopResult(data, {}) : data;
    }

    const msg = formatSbError(error);
    const col = tryExtractMissingColumn(msg);
    if (col && OPTIONAL_SHOP_COLUMNS.includes(col as any)) {
      excluded.add(col);
      continue;
    }

    throw new Error(`[${SHOP_TABLE}] ${msg}`);
  }

  throw new Error(`[${SHOP_TABLE}] Load failed after stripping optional columns`);
}

export async function POST(req: Request) {
  try {
    const { user } = await requireSessionUser(req);
    const body = await req.json().catch(() => ({}));

    const first_name = s(body.first_name);
    const last_name = s(body.last_name);
    const company_name = s(body.company_name);
    const normalizedEmail = normalizeEmail(user.email ?? "");
    const normalizedPhone = normalizePhone(body.phone);

    if (!first_name) return NextResponse.json({ ok: false, error: "first_name required" }, { status: 400 });
    if (!last_name) return NextResponse.json({ ok: false, error: "last_name required" }, { status: 400 });
    if (!company_name || company_name.length < 2) {
      return NextResponse.json({ ok: false, error: "company_name required" }, { status: 400 });
    }
    if (!normalizedEmail) return NextResponse.json({ ok: false, error: "Account email is required." }, { status: 400 });
    if (!normalizedPhone) return NextResponse.json({ ok: false, error: "Enter a valid phone number." }, { status: 400 });

    const admin = supabaseAdmin();
    await serviceRolePreflight(admin, user.id);

    const onboardingState = await getOnboardingState(user.id);
    if (!onboardingState) {
      return NextResponse.json({ ok: false, error: "Verify your email and phone before creating a trial shop." }, { status: 400 });
    }

    if (normalizeEmail(onboardingState.email) !== normalizedEmail) {
      return NextResponse.json({ ok: false, error: "Verified email must match the signed-in RunBook account." }, { status: 400 });
    }

    if (normalizePhone(onboardingState.phone) !== normalizedPhone) {
      return NextResponse.json({ ok: false, error: "Verified phone number must match the shop setup phone number." }, { status: 400 });
    }

    if (!onboardingState.email_verified || !onboardingState.phone_verified) {
      return NextResponse.json(
        {
          ok: false,
          error: "Verify both email and phone before creating a trial shop.",
          reason: "verification_incomplete",
        },
        { status: 400 }
      );
    }

    try {
      const { error } = await admin.from(PROFILE_TABLE).upsert({
        id: user.id,
        first_name,
        last_name,
        phone: normalizedPhone,
        email: normalizedEmail,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    } catch {
    }

    const existingShopId = await findExistingOwnedShop(admin, user.id);
    if (existingShopId) {
      const existingShop = await loadShop(admin, existingShopId);
      if (!existingShop?.id) {
        throw new Error(`[${SHOP_TABLE}] Existing shop not found for owner/admin membership.`);
      }

      return NextResponse.json({
        ok: true,
        existing: true,
        shop_id: existingShop.id,
        shop_name: existingShop.name,
        billing_status: existingShop.billing_status,
        trial_started_at: existingShop.trial_started_at ?? null,
        trial_ends_at: existingShop.trial_ends_at ?? null,
        trial_restricted: Boolean(existingShop.trial_restricted),
        trial_restriction_reason: existingShop.trial_restriction_reason ?? null,
        shop_table: SHOP_TABLE,
        membership_table: MEMBER_TABLE,
      });
    }

    const now = new Date();
    const trialEnds = new Date(now.getTime());
    trialEnds.setUTCDate(trialEnds.getUTCDate() + TRIAL_DAYS);
    const trialDeviceId = onboardingState.device_id ?? sOrNull(req.headers.get("x-runbook-device-id")) ?? null;
    const trialEmailHash = hashIdentityValue(normalizedEmail);
    const trialPhoneHash = hashIdentityValue(normalizedPhone);
    const reuseRisk = await findTrialReuseRisk({
      deviceId: trialDeviceId,
      emailHash: trialEmailHash,
      phoneHash: trialPhoneHash,
    });

    if (reuseRisk?.field) {
      return duplicateTrialResponse(reuseRisk.field);
    }

    const existingShopNameId = await findExistingShopByName(admin, company_name);
    if (existingShopNameId) {
      return duplicateShopNameResponse();
    }

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
      billing_status: "trialing",
      trial_started_at: now.toISOString(),
      trial_ends_at: trialEnds.toISOString(),
      billing_current_period_end: null,
      grace_ends_at: null,
      stripe_customer_id: null,
      stripe_subscription_id: null,
      subscription_plan: null,
      entitlement_override: null,
      trial_device_id: trialDeviceId,
      trial_email_hash: trialEmailHash,
      trial_phone_hash: trialPhoneHash,
      trial_restricted: false,
      trial_restriction_reason: null,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };

    const shop = await createShop(admin, shopPayload);
    await createMembership(admin, shop.id, user.id);
    await upsertOnboardingState(user.id, {
      full_name: `${first_name} ${last_name}`.trim(),
      email: normalizedEmail,
      phone: normalizedPhone,
      shop_name: shop.name ?? company_name,
      shop_id: shop.id,
    });

    return NextResponse.json({
      ok: true,
      existing: false,
      shop_id: shop.id,
      shop_name: shop.name,
      billing_status: shop.billing_status,
      trial_started_at: shop.trial_started_at ?? shopPayload.trial_started_at,
      trial_ends_at: shop.trial_ends_at ?? shopPayload.trial_ends_at,
      trial_restricted: Boolean(shop.trial_restricted),
      trial_restriction_reason: shop.trial_restriction_reason ?? null,
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
