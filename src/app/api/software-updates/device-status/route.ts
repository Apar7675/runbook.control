import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";
import { hashToken } from "@/lib/device/tokens";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const allowedChannels = new Set(["dev", "beta", "stable"]);
const allowedStatuses = new Set([
  "unknown",
  "current",
  "available",
  "required",
  "installing",
  "succeeded",
  "failed",
  "blocked",
  "pending_restart",
]);

function rbAssertUuid(label: string, value: string) {
  const ok = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  if (!ok) throw new Error(`${label} must be a UUID. Got: ${value}`);
}

function getBearerToken(req: Request): string | null {
  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() ?? null;
}

function asText(value: unknown) {
  return String(value ?? "").trim();
}

function asOptionalText(value: unknown, maxLength?: number) {
  const text = asText(value);
  if (!text) return null;
  if (maxLength && text.length > maxLength) {
    throw new Error(`Value exceeds maximum length of ${maxLength} characters.`);
  }
  return text;
}

function summarizeVersions(args: {
  channel: string;
  updateStatus: string;
  desktopVersion: string | null;
  serviceVersion: string | null;
  workstationVersion: string | null;
  mobileVersion: string | null;
  lastError: string | null;
}) {
  const parts = [
    `channel=${args.channel}`,
    `status=${args.updateStatus}`,
    `desktop=${args.desktopVersion ?? "n/a"}`,
    `service=${args.serviceVersion ?? "n/a"}`,
    `workstation=${args.workstationVersion ?? "n/a"}`,
    `mobile=${args.mobileVersion ?? "n/a"}`,
  ];

  if (args.lastError) {
    parts.push(`last_error=${args.lastError.slice(0, 160)}`);
  }

  return parts.join("; ");
}

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    rateLimitOrThrow({ key: `software-status:ip:${ip}`, limit: 600, windowMs: 60_000 });

    const rawToken = getBearerToken(req);
    if (!rawToken) {
      return NextResponse.json({ ok: false, error: "Missing Authorization: Bearer <token>" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({} as Record<string, unknown>));

    const deviceId = asText(body.deviceId);
    const shopId = asText(body.shopId);
    const deviceName = asOptionalText(body.deviceName, 160);
    const desktopVersion = asOptionalText(body.desktopVersion, 64);
    const serviceVersion = asOptionalText(body.serviceVersion, 64);
    const workstationVersion = asOptionalText(body.workstationVersion, 64);
    const mobileVersion = asOptionalText(body.mobileVersion, 64);
    const channel = asText(body.channel).toLowerCase();
    const updateStatus = asText(body.updateStatus).toLowerCase();
    const lastError = asOptionalText(body.lastError, 1000);

    if (!deviceId) return NextResponse.json({ ok: false, error: "deviceId is required." }, { status: 400 });
    if (!shopId) return NextResponse.json({ ok: false, error: "shopId is required." }, { status: 400 });
    rbAssertUuid("deviceId", deviceId);
    rbAssertUuid("shopId", shopId);

    if (!allowedChannels.has(channel)) {
      return NextResponse.json({ ok: false, error: "channel must be dev, beta, or stable." }, { status: 400 });
    }
    if (!allowedStatuses.has(updateStatus)) {
      return NextResponse.json({ ok: false, error: "updateStatus is not valid." }, { status: 400 });
    }

    const admin = supabaseAdmin();
    const tokenHash = hashToken(rawToken);

    const { data: tokenRow, error: tokenError } = await admin
      .from("rb_device_tokens")
      .select("id,device_id,revoked_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (tokenError) return NextResponse.json({ ok: false, error: tokenError.message }, { status: 500 });
    if (!tokenRow) return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 401 });
    if (tokenRow.revoked_at) return NextResponse.json({ ok: false, error: "Token revoked" }, { status: 403 });

    rbAssertUuid("token.device_id", String(tokenRow.device_id));
    if (String(tokenRow.device_id) !== deviceId) {
      return NextResponse.json({ ok: false, error: "Token does not match deviceId." }, { status: 403 });
    }

    rateLimitOrThrow({ key: `software-status:device:${deviceId}`, limit: 600, windowMs: 60_000 });

    const { data: deviceRow, error: deviceError } = await admin
      .from("rb_devices")
      .select("id,shop_id,status,name")
      .eq("id", deviceId)
      .maybeSingle();

    if (deviceError) return NextResponse.json({ ok: false, error: deviceError.message }, { status: 500 });
    if (!deviceRow?.id) return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 401 });

    rbAssertUuid("device.shop_id", String(deviceRow.shop_id));

    if (String(deviceRow.shop_id) !== shopId) {
      return NextResponse.json({ ok: false, error: "shopId does not match the authorized device." }, { status: 403 });
    }

    if (String(deviceRow.status ?? "").toLowerCase() !== "active") {
      return NextResponse.json({ ok: false, error: "Device inactive" }, { status: 403 });
    }

    const now = new Date().toISOString();
    const summary = summarizeVersions({
      channel,
      updateStatus,
      desktopVersion,
      serviceVersion,
      workstationVersion,
      mobileVersion,
      lastError,
    });

    const statusPayload = {
      device_id: deviceId,
      shop_id: shopId,
      device_name: deviceName ?? asOptionalText(deviceRow.name, 160),
      desktop_version: desktopVersion,
      service_version: serviceVersion,
      workstation_version: workstationVersion,
      mobile_version: mobileVersion,
      channel,
      update_status: updateStatus,
      last_check_at: now,
      last_error: lastError,
    };

    const { error: statusError } = await admin
      .from("rb_device_software_status")
      .upsert(statusPayload, { onConflict: "device_id" });

    if (statusError) {
      return NextResponse.json({ ok: false, error: statusError.message }, { status: 500 });
    }

    const { error: eventError } = await admin
      .from("rb_software_update_events")
      .insert({
        shop_id: shopId,
        device_id: deviceId,
        app_name: "control",
        event_type: "checked",
        message: summary,
      });

    if (eventError) {
      return NextResponse.json({ ok: false, error: eventError.message }, { status: 500 });
    }

    await admin.from("rb_device_tokens").update({ last_seen_at: now }).eq("id", tokenRow.id);
    await admin.from("rb_devices").update({ last_seen_at: now }).eq("id", deviceId);

    return NextResponse.json({
      ok: true,
      device_id: deviceId,
      shop_id: shopId,
      channel,
      update_status: updateStatus,
      at: now,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    const status =
      /missing authorization/i.test(message) ? 401 :
      /must be a uuid/i.test(message) ? 400 :
      /maximum length/i.test(message) ? 400 :
      500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
