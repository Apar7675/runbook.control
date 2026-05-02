import { NextResponse } from "next/server";
import { assertUuid } from "@/lib/authz";
import { describeShopAccess } from "@/lib/billing/access";
import { getShopEntitlement } from "@/lib/billing/entitlement";
import { requireSessionUser } from "@/lib/desktopAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SubmitStatus = "APPROVED" | "PENDING_REVIEW" | "BLOCKED";
type PunchPolicy =
  | "DISABLED"
  | "ALLOW_ANYWHERE"
  | "GPS_GEOFENCE"
  | "LOCAL_NETWORK"
  | "GPS_OR_LOCAL_NETWORK"
  | "GPS_AND_LOCAL_NETWORK";
type FailureMode = "BLOCK" | "PENDING_REVIEW";

const EVENT_TYPES = new Set(["CLOCK_IN", "CLOCK_OUT", "BREAK_START", "BREAK_END", "LUNCH_START", "LUNCH_END"]);

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseIso(value: unknown): string | null {
  const candidate = text(value);
  if (!candidate) return null;
  const parsed = Date.parse(candidate);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function jsonStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => text(item)).filter(Boolean);
}

function toIPv4Int(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) return null;
    value = (value << 8) + octet;
  }
  return value >>> 0;
}

function ipv4InCidr(ip: string, cidr: string): boolean {
  const [networkRaw, bitsRaw] = cidr.split("/");
  const ipInt = toIPv4Int(text(ip));
  const networkInt = toIPv4Int(text(networkRaw));
  const bits = bitsRaw === undefined ? 32 : Number(bitsRaw);
  if (ipInt === null || networkInt === null || !Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipInt & mask) === (networkInt & mask);
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = 6371000;
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function evaluateGps(shop: any, evidence: any): { ok: boolean; reason: string; distanceMeters?: number } {
  const lat = finiteNumber(evidence.gps_latitude);
  const lng = finiteNumber(evidence.gps_longitude);
  const accuracy = finiteNumber(evidence.gps_accuracy_meters);
  const shopLat = finiteNumber(shop.mobile_geofence_lat);
  const shopLng = finiteNumber(shop.mobile_geofence_lng);
  const radius = finiteNumber(shop.mobile_geofence_radius_meters);
  const maxAccuracy = finiteNumber(shop.mobile_max_gps_accuracy_meters);

  if (lat === null || lng === null || accuracy === null) {
    return { ok: false, reason: "GPS evidence is required for mobile timeclock." };
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { ok: false, reason: "GPS evidence is outside valid coordinate bounds." };
  }
  if (shopLat === null || shopLng === null || radius === null || radius <= 0) {
    return { ok: false, reason: "Shop mobile geofence is not configured." };
  }
  if (maxAccuracy !== null && accuracy > maxAccuracy) {
    return { ok: false, reason: `GPS accuracy ${Math.round(accuracy)}m is weaker than the shop limit.` };
  }

  const distanceMeters = haversineMeters(lat, lng, shopLat, shopLng);
  if (distanceMeters > radius) {
    return { ok: false, reason: `Device is ${Math.round(distanceMeters)}m from the approved geofence.` , distanceMeters };
  }

  return { ok: true, reason: "GPS geofence passed.", distanceMeters };
}

function evaluateLan(shop: any, evidence: any): { ok: boolean; reason: string } {
  const cidrs = jsonStringArray(shop.mobile_allowed_network_cidrs);
  const ssids = jsonStringArray(shop.mobile_allowed_wifi_ssids).map((v) => v.toLowerCase());
  const bssids = jsonStringArray(shop.mobile_allowed_wifi_bssids).map((v) => v.toLowerCase());
  const localIp = text(evidence.local_ip);
  const wifiSsid = text(evidence.wifi_ssid).toLowerCase();
  const wifiBssid = text(evidence.wifi_bssid).toLowerCase();

  const cidrPass = Boolean(localIp && cidrs.length && cidrs.some((cidr) => ipv4InCidr(localIp, cidr)));
  const ssidPass = Boolean(wifiSsid && ssids.length && ssids.includes(wifiSsid));
  const bssidPass = Boolean(wifiBssid && bssids.length && bssids.includes(wifiBssid));

  if (cidrPass || ssidPass || bssidPass) return { ok: true, reason: "Local network evidence passed." };
  if (!localIp && !wifiSsid && !wifiBssid) return { ok: false, reason: "Local network evidence is required for mobile timeclock." };
  return { ok: false, reason: "Device was not on an approved local network." };
}

function evaluatePolicy(shop: any, evidence: any): { accepted: boolean; reason: string; detail: Record<string, unknown> } {
  const policy = text(shop.mobile_punch_policy).toUpperCase() as PunchPolicy;
  if (!shop.mobile_timeclock_enabled || policy === "DISABLED") {
    return { accepted: false, reason: "Mobile timeclock is disabled for this shop.", detail: { policy } };
  }
  if (policy === "ALLOW_ANYWHERE") {
    return { accepted: true, reason: "Mobile timeclock policy allows punches from anywhere.", detail: { policy } };
  }

  const gps = policy.includes("GPS") ? evaluateGps(shop, evidence) : null;
  const lan = policy.includes("LOCAL_NETWORK") ? evaluateLan(shop, evidence) : null;
  let accepted = false;

  if (policy === "GPS_GEOFENCE") accepted = gps?.ok === true;
  if (policy === "LOCAL_NETWORK") accepted = lan?.ok === true;
  if (policy === "GPS_OR_LOCAL_NETWORK") accepted = gps?.ok === true || lan?.ok === true;
  if (policy === "GPS_AND_LOCAL_NETWORK") accepted = gps?.ok === true && lan?.ok === true;

  const failures = [gps, lan].filter((result) => result && !result.ok).map((result) => result?.reason);
  const passes = [gps, lan].filter((result) => result?.ok).map((result) => result?.reason);
  return {
    accepted,
    reason: accepted ? passes.filter(Boolean).join(" ") || "Mobile punch policy passed." : failures.filter(Boolean).join(" ") || "Mobile punch policy failed.",
    detail: { policy, gps, lan },
  };
}

function responseForExisting(row: any, req: Request) {
  const status: SubmitStatus = row.policy_result === "PENDING_REVIEW" || row.needs_review ? "PENDING_REVIEW" : "APPROVED";
  return NextResponse.json(
    {
      ok: true,
      status,
      message: status === "PENDING_REVIEW" ? "Punch was already submitted and is pending review." : "Punch was already submitted.",
      time_event_id: text(row.id) || null,
      needs_review: !!row.needs_review,
      policy_reason: row.policy_reason ?? null,
    },
    { headers: corsHeaders(req) }
  );
}

function blocked(req: Request, message: string, status = 403) {
  return NextResponse.json(
    { ok: false, status: "BLOCKED", message, time_event_id: null, needs_review: false, policy_reason: message },
    { status, headers: corsHeaders(req) }
  );
}

export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export async function POST(req: Request) {
  try {
    const { user } = await requireSessionUser(req);
    const body = await req.json().catch(() => ({}));
    const shopId = text((body as any).shop_id);
    const eventType = text((body as any).event_type).toUpperCase();
    const clientTs = parseIso((body as any).client_ts) ?? new Date().toISOString();
    const deviceId = text((body as any).device_id);
    const offlineId = text((body as any).offline_id);
    const note = text((body as any).note);
    const isOffline = Boolean((body as any).is_offline);
    const evidence = ((body as any).evidence ?? {}) as Record<string, unknown>;

    if (!shopId) return blocked(req, "shop_id is required.", 400);
    assertUuid("shop_id", shopId);
    if (!EVENT_TYPES.has(eventType)) return blocked(req, "event_type is not allowed.", 400);
    if (!offlineId) return blocked(req, "offline_id is required.", 400);

    const admin = supabaseAdmin();
    const { data: employee, error: employeeError } = await admin
      .from("employees")
      .select("id,shop_id,auth_user_id,is_active,runbook_access_enabled,mobile_access_enabled,can_timeclock,mobile_timeclock_enabled,mobile_timeclock_requires_review")
      .eq("shop_id", shopId)
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (employeeError) throw new Error(employeeError.message);
    if (!employee?.id) return blocked(req, "No active employee record was found for this shop.", 403);
    if (!employee.is_active) return blocked(req, "Employee is inactive.", 403);
    if (employee.runbook_access_enabled === false || employee.mobile_access_enabled === false) return blocked(req, "Mobile access is disabled for this employee.", 403);
    if (!employee.can_timeclock) return blocked(req, "Time Clock access is not assigned to this employee.", 403);
    if (!employee.mobile_timeclock_enabled) return blocked(req, "Mobile timeclock is not enabled for this employee.", 403);

    const entitlement = await getShopEntitlement(shopId);
    const access = describeShopAccess(entitlement);
    if (!access.allowed || access.restricted || access.mobile_mode === "blocked") {
      return blocked(req, access.summary || "Mobile access is blocked for this shop.", 403);
    }

    const { data: existing, error: existingError } = await admin
      .from("time_events")
      .select("id,shop_id,employee_id,needs_review,policy_result,policy_reason")
      .eq("offline_id", offlineId)
      .maybeSingle();

    if (existingError) throw new Error(existingError.message);
    if (existing?.id) {
      if (text(existing.shop_id) !== shopId || text(existing.employee_id) !== text(employee.id)) {
        return blocked(req, "offline_id already belongs to another time event.", 409);
      }
      return responseForExisting(existing, req);
    }

    const { data: shop, error: shopError } = await admin
      .from("rb_shops")
      .select("id,mobile_timeclock_enabled,mobile_punch_policy,mobile_punch_failure_mode,mobile_geofence_lat,mobile_geofence_lng,mobile_geofence_radius_meters,mobile_max_gps_accuracy_meters,mobile_allowed_network_cidrs,mobile_allowed_wifi_ssids,mobile_allowed_wifi_bssids")
      .eq("id", shopId)
      .maybeSingle();

    if (shopError) throw new Error(shopError.message);
    if (!shop?.id) return blocked(req, "Shop not found.", 404);

    const evaluated = evaluatePolicy(shop, evidence);
    const failureMode = text(shop.mobile_punch_failure_mode).toUpperCase() as FailureMode;
    const requiresReview = Boolean(employee.mobile_timeclock_requires_review);

    if (!evaluated.accepted && failureMode !== "PENDING_REVIEW") {
      return blocked(req, evaluated.reason, 403);
    }

    const status: SubmitStatus = evaluated.accepted && !requiresReview ? "APPROVED" : "PENDING_REVIEW";
    const needsReview = status === "PENDING_REVIEW";
    const policyReason = requiresReview && evaluated.accepted
      ? "Employee mobile timeclock punches require review."
      : evaluated.reason;
    const evidencePayload = {
      submitted: {
        gps_latitude: finiteNumber(evidence.gps_latitude),
        gps_longitude: finiteNumber(evidence.gps_longitude),
        gps_accuracy_meters: finiteNumber(evidence.gps_accuracy_meters),
        location_captured_at: parseIso(evidence.location_captured_at),
        network_type: text(evidence.network_type) || null,
        wifi_ssid: text(evidence.wifi_ssid) || null,
        wifi_bssid: text(evidence.wifi_bssid) || null,
        local_ip: text(evidence.local_ip) || null,
        app_platform: text(evidence.app_platform) || null,
      },
      result: evaluated.detail,
      failure_mode: failureMode,
      employee_requires_review: requiresReview,
    };

    const { data: inserted, error: upsertError } = await admin
      .from("time_events")
      .upsert(
        {
          employee_id: employee.id,
          shop_id: shopId,
          event_type: eventType,
          client_ts: clientTs,
          source: "mobile",
          device_id: deviceId || "",
          offline_id: offlineId,
          note: note || null,
          is_offline: isOffline,
          needs_review: needsReview,
          gps_latitude: evidencePayload.submitted.gps_latitude,
          gps_longitude: evidencePayload.submitted.gps_longitude,
          gps_accuracy_meters: evidencePayload.submitted.gps_accuracy_meters,
          location_captured_at: evidencePayload.submitted.location_captured_at,
          network_type: evidencePayload.submitted.network_type,
          wifi_ssid: evidencePayload.submitted.wifi_ssid,
          wifi_bssid: evidencePayload.submitted.wifi_bssid,
          local_ip: evidencePayload.submitted.local_ip,
          app_platform: evidencePayload.submitted.app_platform,
          policy_result: status,
          policy_reason: policyReason,
          policy_evidence: evidencePayload,
        },
        { onConflict: "offline_id" }
      )
      .select("id,needs_review,policy_result,policy_reason")
      .maybeSingle();

    if (upsertError) throw new Error(upsertError.message);

    return NextResponse.json(
      {
        ok: true,
        status,
        message: status === "APPROVED" ? "Punch approved." : "Punch submitted and pending review.",
        time_event_id: inserted?.id ?? null,
        needs_review: needsReview,
        policy_reason: policyReason,
      },
      { headers: corsHeaders(req) }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Mobile timeclock submit failed.";
    const status = /not authenticated/i.test(message) ? 401 : /uuid|event_type|offline_id|shop_id/i.test(message) ? 400 : 500;
    return NextResponse.json(
      { ok: false, status: "BLOCKED", message, time_event_id: null, needs_review: false, policy_reason: message },
      { status, headers: corsHeaders(req) }
    );
  }
}
