import { NextResponse } from "next/server";
import { assertUuid } from "@/lib/authz";
import { writeAudit } from "@/lib/audit/writeAudit";
import {
  hasGpsPolicy,
  hasLanPolicy,
  isMobilePunchFailureMode,
  isMobilePunchPolicy,
  SHOP_MOBILE_TIMECLOCK_SELECT_COLUMNS,
  type MobilePunchPolicy,
} from "@/lib/mobileTimeclockPolicy";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";
import { requireShopAdminOrPlatformAdmin } from "@/lib/shopAdminAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function text(value: unknown) {
  return String(value ?? "").trim();
}

function bool(value: unknown) {
  return value === true || value === "true";
}

function numberOrNull(value: unknown, label: string) {
  const raw = text(value);
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) throw new Error(`${label} must be a valid number.`);
  return parsed;
}

function integerOrNull(value: unknown, label: string) {
  const parsed = numberOrNull(value, label);
  if (parsed === null) return null;
  if (!Number.isInteger(parsed)) throw new Error(`${label} must be a whole number.`);
  return parsed;
}

function stringArrayOrNull(value: unknown) {
  const list = Array.isArray(value)
    ? value.map((item) => text(item))
    : text(value)
      .split(/[\n,]/)
      .map((item) => item.trim());
  const clean = Array.from(new Set(list.filter(Boolean)));
  return clean.length ? clean : null;
}

function assertIpv4Cidr(cidr: string) {
  const [ip, bitsRaw] = cidr.split("/");
  const bits = bitsRaw === undefined ? 32 : Number(bitsRaw);
  const parts = ip.split(".");
  if (parts.length !== 4 || !Number.isInteger(bits) || bits < 0 || bits > 32) {
    throw new Error(`Invalid CIDR: ${cidr}`);
  }
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) throw new Error(`Invalid CIDR: ${cidr}`);
    const octet = Number(part);
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) throw new Error(`Invalid CIDR: ${cidr}`);
  }
}

function normalizePatch(body: any) {
  const mobileTimeclockEnabled = bool(body.mobile_timeclock_enabled);
  const policyRaw = text(body.mobile_punch_policy).toUpperCase() || "DISABLED";
  const failureModeRaw = text(body.mobile_punch_failure_mode).toUpperCase() || "BLOCK";

  if (!isMobilePunchPolicy(policyRaw)) throw new Error("Verification method is not valid.");
  if (!isMobilePunchFailureMode(failureModeRaw)) throw new Error("Failure mode is not valid.");

  const policy = policyRaw as MobilePunchPolicy;
  const lat = numberOrNull(body.mobile_geofence_lat, "Shop latitude");
  const lng = numberOrNull(body.mobile_geofence_lng, "Shop longitude");
  const radius = integerOrNull(body.mobile_geofence_radius_meters, "Allowed radius");
  const maxAccuracyInput = integerOrNull(body.mobile_max_gps_accuracy_meters, "Max GPS accuracy");
  const maxAccuracy = hasGpsPolicy(policy) ? (maxAccuracyInput ?? 100) : maxAccuracyInput;
  const cidrs = stringArrayOrNull(body.mobile_allowed_network_cidrs);
  const ssids = stringArrayOrNull(body.mobile_allowed_wifi_ssids);
  const bssids = stringArrayOrNull(body.mobile_allowed_wifi_bssids);

  if (lat !== null && (lat < -90 || lat > 90)) throw new Error("Shop latitude must be between -90 and 90.");
  if (lng !== null && (lng < -180 || lng > 180)) throw new Error("Shop longitude must be between -180 and 180.");
  if (radius !== null && radius <= 0) throw new Error("Allowed radius must be positive.");
  if (maxAccuracy !== null && maxAccuracy <= 0) throw new Error("Max GPS accuracy must be positive.");

  if (hasGpsPolicy(policy)) {
    if (lat === null || lng === null) throw new Error("Shop latitude and longitude are required when GPS is required.");
    if (radius === null || radius <= 0) throw new Error("Allowed radius must be positive when GPS is required.");
  }

  if (policy === "LOCAL_NETWORK" && !cidrs?.length) {
    throw new Error("Allowed local network CIDRs are required when local network is the only verification method.");
  }

  if (hasLanPolicy(policy) && cidrs) {
    for (const cidr of cidrs) assertIpv4Cidr(cidr);
  }

  return {
    mobile_timeclock_enabled: mobileTimeclockEnabled,
    mobile_punch_policy: mobileTimeclockEnabled ? policy : "DISABLED",
    mobile_punch_failure_mode: failureModeRaw,
    mobile_geofence_lat: lat,
    mobile_geofence_lng: lng,
    mobile_geofence_radius_meters: radius,
    mobile_max_gps_accuracy_meters: maxAccuracy,
    mobile_allowed_network_cidrs: cidrs,
    mobile_allowed_wifi_ssids: ssids,
    mobile_allowed_wifi_bssids: bssids,
  };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const shopId = text(url.searchParams.get("shop_id"));
    if (!shopId) return NextResponse.json({ ok: false, error: "Missing shop_id" }, { status: 400 });
    assertUuid("shop_id", shopId);
    await requireShopAdminOrPlatformAdmin(shopId);

    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("rb_shops")
      .select(SHOP_MOBILE_TIMECLOCK_SELECT_COLUMNS.join(","))
      .eq("id", shopId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    const shop = data as any;
    if (!shop?.id) return NextResponse.json({ ok: false, error: "Shop not found" }, { status: 404 });
    return NextResponse.json({ ok: true, shop });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    const status =
      /not authenticated/i.test(msg) ? 401 :
      /mfa required|access denied/i.test(msg) ? 403 :
      /uuid/i.test(msg) ? 400 :
      500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    rateLimitOrThrow({ key: `shops:mobile-timeclock-policy:${ip}`, limit: 60, windowMs: 60_000 });

    const body = await req.json().catch(() => ({}));
    const shopId = text((body as any).shop_id);
    if (!shopId) return NextResponse.json({ ok: false, error: "Missing shop_id" }, { status: 400 });
    assertUuid("shop_id", shopId);

    const { user } = await requireShopAdminOrPlatformAdmin(shopId);
    const patch = normalizePatch(body);
    const admin = supabaseAdmin();

    const { data: current, error: currentError } = await admin
      .from("rb_shops")
      .select(SHOP_MOBILE_TIMECLOCK_SELECT_COLUMNS.join(","))
      .eq("id", shopId)
      .maybeSingle();

    if (currentError) throw new Error(currentError.message);
    const currentShop = current as any;
    if (!currentShop?.id) return NextResponse.json({ ok: false, error: "Shop not found" }, { status: 404 });

    const { data: updated, error: updateError } = await admin
      .from("rb_shops")
      .update(patch)
      .eq("id", shopId)
      .select(SHOP_MOBILE_TIMECLOCK_SELECT_COLUMNS.join(","))
      .single();

    if (updateError) throw new Error(updateError.message);
    const updatedShop = updated as any;

    await writeAudit({
      actor_user_id: user.id,
      actor_email: user.email ?? null,
      action: "mobile_timeclock_policy.updated",
      target_type: "shop",
      target_id: shopId,
      shop_id: shopId,
      meta: { before: currentShop, after: updatedShop },
    });

    return NextResponse.json({ ok: true, shop: updatedShop });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    const status =
      /not authenticated/i.test(msg) ? 401 :
      /mfa required|access denied/i.test(msg) ? 403 :
      /uuid|valid|positive|required|cidr|latitude|longitude/i.test(msg) ? 400 :
      500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
