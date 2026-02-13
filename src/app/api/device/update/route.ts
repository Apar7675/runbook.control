// REPLACE ENTIRE FILE: src/app/api/device/update/route.ts
//
// HARDENING (this pass):
// - Adds rate limit (this endpoint is brute-forceable).
// - UUID tripwire for deviceId + shop_id.
// - Stops selecting "*" everywhere (least privilege).
// - Uses constant-time compare for device key hashes (timingSafeEqual).
// - Returns consistent { ok, ... } JSON shapes.
// - Keeps legacy deviceKey auth (for now), but isolates it and makes it stricter.
// - Never leaks whether a deviceId exists via different error messages (same 401 path).
// - Best-effort audit (does not fail update if audit insert fails).
//
// NOTE: Long term: migrate ALL devices to Bearer token check-in (rb_device_tokens) and remove deviceKey entirely.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";
import { sha256Hex } from "@/lib/crypto";
import crypto from "crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function rbAssertUuid(label: string, value: string) {
  const ok = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  if (!ok) throw new Error(`${label} must be a UUID. Got: ${value}`);
}

function timingSafeEqualHex(aHex: string, bHex: string): boolean {
  try {
    const a = Buffer.from(String(aHex || ""), "hex");
    const b = Buffer.from(String(bHex || ""), "hex");
    if (a.length !== b.length || a.length === 0) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    rateLimitOrThrow({ key: `device:update:${ip}`, limit: 600, windowMs: 60_000 });

    const body = await req.json().catch(() => ({} as any));

    const deviceId = String(body?.deviceId ?? "").trim();
    const deviceKey = String(body?.deviceKey ?? "").trim();
    const currentVersion = String(body?.currentVersion ?? "").trim() || null; // optional

    if (!deviceId || !deviceKey) {
      return NextResponse.json({ ok: false, error: "Missing deviceId or deviceKey" }, { status: 400 });
    }

    rbAssertUuid("deviceId", deviceId);

    const admin = supabaseAdmin();

    // Minimal device fields needed to authorize + choose updates
    const { data: device, error: e1 } = await admin
      .from("rb_devices")
      .select("id,shop_id,status,device_key_hash,name,device_type")
      .eq("id", deviceId)
      .maybeSingle();

    if (e1) return NextResponse.json({ ok: false, error: e1.message }, { status: 500 });

    // Avoid leaking existence: if device missing OR key mismatch => 401 "Unauthorized device"
    if (!device?.id || !device.device_key_hash) {
      return NextResponse.json({ ok: false, error: "Unauthorized device" }, { status: 401 });
    }

    rbAssertUuid("device.shop_id", String(device.shop_id));

    const providedHashHex = sha256Hex(deviceKey); // hex string
    const okKey = timingSafeEqualHex(String(device.device_key_hash), String(providedHashHex));
    if (!okKey) {
      return NextResponse.json({ ok: false, error: "Unauthorized device" }, { status: 401 });
    }

    if (String(device.status) !== "active") {
      return NextResponse.json({ ok: false, error: "Device disabled" }, { status: 403 });
    }

    // Get update policy for device's shop
    const { data: pol, error: e2 } = await admin
      .from("rb_update_policy")
      .select("shop_id,channel,min_version,pinned_version")
      .eq("shop_id", device.shop_id)
      .maybeSingle();

    if (e2) return NextResponse.json({ ok: false, error: e2.message }, { status: 500 });

    const channel = String(pol?.channel ?? "stable");
    const pinned = pol?.pinned_version ? String(pol.pinned_version) : null;

    // Choose package
    let pkg: any = null;

    if (pinned) {
      const r = await admin
        .from("rb_update_packages")
        .select("id,channel,version,notes,sha256,file_path,created_at")
        .eq("channel", channel)
        .eq("version", pinned)
        .maybeSingle();
      if (r.error) return NextResponse.json({ ok: false, error: r.error.message }, { status: 500 });
      pkg = r.data ?? null;
    }

    if (!pkg) {
      const r = await admin
        .from("rb_update_packages")
        .select("id,channel,version,notes,sha256,file_path,created_at")
        .eq("channel", channel)
        .order("created_at", { ascending: false })
        .limit(1);
      if (r.error) return NextResponse.json({ ok: false, error: r.error.message }, { status: 500 });
      pkg = (r.data ?? [])[0] ?? null;
    }

    if (!pkg) return NextResponse.json({ ok: true, update: null }, { status: 200 });

    // If already on that version, return no update
    if (currentVersion && String(currentVersion) === String(pkg.version)) {
      return NextResponse.json({ ok: true, update: null }, { status: 200 });
    }

    // Signed URL for private bucket download
    const { data: signed, error: e3 } = await admin.storage.from("rb-updates").createSignedUrl(pkg.file_path, 60);
    if (e3) return NextResponse.json({ ok: false, error: e3.message }, { status: 500 });

    // Best-effort audit (do not fail update response)
    try {
      await admin.from("rb_audit").insert({
        shop_id: device.shop_id,
        actor_kind: "device",
        actor_user_id: null,
        action: "device.update.check",
        entity_type: "device",
        entity_id: device.id,
        details: {
          device_name: device.name ?? null,
          device_type: device.device_type ?? null,
          currentVersion,
          channel,
          chosenVersion: pkg.version ?? null,
          pinned: pinned ?? null,
        },
      });
    } catch {
      // ignore
    }

    return NextResponse.json(
      {
        ok: true,
        update: {
          channel: pkg.channel,
          version: pkg.version,
          notes: pkg.notes ?? null,
          sha256: pkg.sha256 ?? null,
          downloadUrl: signed?.signedUrl ?? null,
        },
      },
      { status: 200 }
    );
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    const status = /missing deviceid/i.test(msg) ? 400 : /must be a uuid/i.test(msg) ? 400 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
