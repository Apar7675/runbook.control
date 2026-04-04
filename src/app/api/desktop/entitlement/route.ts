import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireSessionUser } from "@/lib/desktopAuth";
import { getShopEntitlement } from "@/lib/billing/entitlement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BillingStatus = "trialing" | "active" | "past_due" | "canceled" | "expired";

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function parsePositiveInt(raw: string | undefined, fallback: number) {
  const value = Number.parseInt(String(raw ?? ""), 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function b64url(buf: Buffer) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function pemEnv(name: string) {
  return env(name).replace(/\\n/g, "\n");
}

function signPayload(payloadJson: string) {
  const privateKeyPem = pemEnv("RUNBOOK_DESKTOP_ENTITLEMENT_PRIVATE_KEY_PEM");
  const keyId = (process.env.RUNBOOK_DESKTOP_ENTITLEMENT_KEY_ID ?? "desktop-entitlement-v1").trim() || "desktop-entitlement-v1";
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(payloadJson, "utf8");
  signer.end();

  return {
    version: 1,
    algorithm: "RS256",
    key_id: keyId,
    payload_b64: b64url(Buffer.from(payloadJson, "utf8")),
    signature_b64: b64url(signer.sign(privateKeyPem)),
  };
}

function addHours(iso: string, hours: number) {
  const at = new Date(iso);
  at.setUTCHours(at.getUTCHours() + hours);
  return at.toISOString();
}

function minIso(a: string, b: string) {
  return Date.parse(a) <= Date.parse(b) ? a : b;
}

function computeRefreshAfter(nowIso: string, entitlement: { allowed: boolean; restricted: boolean }) {
  const minutes = entitlement.allowed && !entitlement.restricted ? 15 : 5;
  const at = new Date(nowIso);
  at.setUTCMinutes(at.getUTCMinutes() + minutes);
  return at.toISOString();
}

function computeOfflineAccessUntil(
  nowIso: string,
  offlineGraceHours: number,
  status: BillingStatus,
  entitlement: { allowed: boolean; restricted: boolean },
  trialEndsAt: string | null
) {
  if (!entitlement.allowed || entitlement.restricted) return nowIso;

  const defaultUntil = addHours(nowIso, offlineGraceHours);
  if (status === "trialing" && trialEndsAt) return minIso(defaultUntil, trialEndsAt);
  return defaultUntil;
}

function tryExtractMissingColumn(msg: string): string | null {
  const text = String(msg ?? "");
  const relationMatch = text.match(/column\s+"([^"]+)"\s+of\s+relation/i);
  if (relationMatch?.[1]) return relationMatch[1];

  const schemaCacheMatch = text.match(/Could not find the '([^']+)' column/i);
  if (schemaCacheMatch?.[1]) return schemaCacheMatch[1];

  const qualifiedMatch = text.match(/column\s+rb_shops\.([a-zA-Z0-9_]+)\s+does\s+not\s+exist/i);
  if (qualifiedMatch?.[1]) return qualifiedMatch[1];

  return null;
}

async function loadShopTrialEndsWithAutoStrip(admin: ReturnType<typeof supabaseAdmin>, shopId: string) {
  let columns = ["trial_ends_at"];

  for (let attempt = 0; attempt < 2; attempt++) {
    const selectCols = columns.length > 0 ? columns.join(",") : "id";
    const { data, error } = await admin
      .from("rb_shops")
      .select(selectCols)
      .eq("id", shopId)
      .maybeSingle();

    if (!error) return data as { trial_ends_at?: string | null } | null;

    const msg = String(error.message ?? error ?? "");
    const col = tryExtractMissingColumn(msg);
    if (col && columns.includes(col)) {
      columns = columns.filter((entry) => entry !== col);
      continue;
    }

    throw new Error(msg);
  }

  throw new Error("Desktop entitlement shop lookup failed after stripping missing columns");
}

async function requireActiveDevice(admin: ReturnType<typeof supabaseAdmin>, shopId: string, deviceId: string) {
  const { data: device, error } = await admin
    .from("rb_devices")
    .select("id,shop_id,status")
    .eq("id", deviceId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!device?.id) return { ok: false, error: "Device not registered for this shop." };
  if (String(device.shop_id ?? "").trim() !== shopId) return { ok: false, error: "Device not registered for this shop." };
  if (String(device.status ?? "").trim().toLowerCase() !== "active") return { ok: false, error: "Device inactive." };
  return { ok: true as const };
}

export async function POST(req: Request) {
  try {
    const { user } = await requireSessionUser(req);
    const body = await req.json().catch(() => ({}));
    const shop_id = String(body.shop_id ?? "").trim();
    const device_id = String(body.device_id ?? "").trim();

    if (!shop_id) return NextResponse.json({ ok: false, error: "Missing shop_id" }, { status: 400 });
    if (!device_id) return NextResponse.json({ ok: false, error: "Missing device_id" }, { status: 400 });

    const admin = supabaseAdmin();
    const { data: mem } = await admin
      .from("rb_shop_members")
      .select("role")
      .eq("shop_id", shop_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!mem) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

    const deviceCheck = await requireActiveDevice(admin, shop_id, device_id);
    if (!deviceCheck.ok) {
      return NextResponse.json({ ok: false, error: deviceCheck.error }, { status: 403 });
    }

    const entitlement = await getShopEntitlement(shop_id);
    const shop = await loadShopTrialEndsWithAutoStrip(admin, shop_id);

    const nowIso = new Date().toISOString();
    const offlineGraceHours = parsePositiveInt(process.env.RUNBOOK_DESKTOP_OFFLINE_GRACE_HOURS, 72);
    const refreshAfterIso = computeRefreshAfter(nowIso, entitlement);
    const offlineAccessUntilIso = computeOfflineAccessUntil(
      nowIso,
      offlineGraceHours,
      entitlement.status,
      entitlement,
      (shop?.trial_ends_at as string | null | undefined) ?? null
    );

    const payload = {
      ver: 1,
      iss: "runbook.control",
      shop_id,
      device_id,
      server_time_utc: nowIso,
      issued_at_utc: nowIso,
      refresh_after_utc: refreshAfterIso,
      offline_access_until_utc: offlineAccessUntilIso,
      rollback_tolerance_seconds: 300,
      entitlement: {
        status: entitlement.status,
        allowed: entitlement.allowed,
        restricted: entitlement.restricted,
        reason: entitlement.reason,
        grace_active: entitlement.grace_active,
      },
    };

    const payloadJson = JSON.stringify(payload);
    const envelope = signPayload(payloadJson);

    return NextResponse.json({ ok: true, envelope, payload });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    const status = /not authenticated/i.test(msg) ? 401 : 400;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
