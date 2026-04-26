// REPLACE ENTIRE FILE: src/app/api/device/activate/route.ts
//
// HARDENING (this pass):
// - Rate limit (activation tokens are attack surface).
// - Adds UUID tripwire on device/shop ids when read.
// - Makes token consumption atomic-ish: update used_at with guard used_at IS NULL.
// - Returns consistent { ok, ... } shape (matches your other routes style).
// - Writes audit via service role (kept).
//
// NOTE: This is device-side activation, so there is NO user session / billing gate here.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";
import { sha256Hex } from "@/lib/crypto";
import { writeAudit } from "@/lib/audit/writeAudit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function rbAssertUuid(label: string, value: string) {
  const ok = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  if (!ok) throw new Error(`${label} must be a UUID. Got: ${value}`);
}

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    rateLimitOrThrow({ key: `device:activate:${ip}`, limit: 120, windowMs: 60_000 });

    const body = await req.json().catch(() => null);
    const token = String((body as any)?.token ?? "").trim();
    if (!token) return NextResponse.json({ ok: false, error: "Missing token" }, { status: 400 });

    const token_hash = sha256Hex(token);
    const admin = supabaseAdmin();

    const { data: row, error: e1 } = await admin
      .from("rb_device_activation_tokens")
      .select("id, device_id, used_at, expires_at, token_hash")
      .eq("token_hash", token_hash)
      .maybeSingle();

    if (e1) return NextResponse.json({ ok: false, error: e1.message }, { status: 500 });
    if (!row) return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 401 });
    if (row.used_at) return NextResponse.json({ ok: false, error: "Token already used" }, { status: 409 });
    if (new Date(row.expires_at).getTime() < Date.now())
      return NextResponse.json({ ok: false, error: "Token expired" }, { status: 410 });

    rbAssertUuid("device_id", String(row.device_id));

    // Guarded consume: only set used_at if it is still NULL
    const nowIso = new Date().toISOString();
    const { data: consumed, error: e2 } = await admin
      .from("rb_device_activation_tokens")
      .update({ used_at: nowIso })
      .eq("id", row.id)
      .is("used_at", null)
      .select("id")
      .maybeSingle();

    if (e2) return NextResponse.json({ ok: false, error: e2.message }, { status: 500 });
    if (!consumed?.id) return NextResponse.json({ ok: false, error: "Token already used" }, { status: 409 });

    const { data: device, error: e3 } = await admin
      .from("rb_devices")
      .select("id, shop_id, name, status, created_at")
      .eq("id", row.device_id)
      .single();

    if (e3) return NextResponse.json({ ok: false, error: e3.message }, { status: 500 });

    rbAssertUuid("device.id", String(device.id));
    rbAssertUuid("device.shop_id", String(device.shop_id));

    try {
      await writeAudit({
        actor_user_id: null,
        actor_email: null,
        actor_kind: "device",
        action: "device.activated",
        target_type: "device",
        target_id: String(device.id),
        shop_id: String(device.shop_id),
        meta: { device_name: device.name, activated_at: nowIso },
      });
    } catch (auditErr: any) {
      console.warn("device activate: audit insert failed:", auditErr?.message ?? auditErr);
    }

    return NextResponse.json({ ok: true, device }, { status: 200 });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    const status = /missing token/i.test(msg) ? 400 : /must be a uuid/i.test(msg) ? 400 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
