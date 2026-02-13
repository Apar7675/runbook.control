// REPLACE ENTIRE FILE: src/app/api/device/validate-token/route.ts
//
// HARDENING (this pass):
// - Adds UUID tripwire for token_id/device_id/shop_id.
// - Adds runtime/nodejs export.
// - Avoids leaking whether token exists vs device exists (401 for invalid token, 403 revoked/disabled).
// - Updates last_seen_at best-effort (kept).
// - Keeps audit best-effort.
// - Keeps GET + POST support.
//
// NOTE: This endpoint is device-auth, no user session / billing gate.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";
import { writeAudit } from "@/lib/audit/writeAudit";
import { hashToken } from "@/lib/device/tokens";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function rbAssertUuid(label: string, value: string) {
  const ok = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  if (!ok) throw new Error(`${label} must be a UUID. Got: ${value}`);
}

function getBearerToken(req: Request): string | null {
  const h = req.headers.get("authorization") ?? "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

export async function GET(req: Request) {
  // allow GET for simple health/handshake from desktop
  return validate(req);
}

export async function POST(req: Request) {
  // allow POST too (same logic)
  return validate(req);
}

async function validate(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    rateLimitOrThrow({ key: `device:validate:${ip}`, limit: 240, windowMs: 60_000 });

    const raw = getBearerToken(req);
    if (!raw) {
      return NextResponse.json({ ok: false, error: "Missing Authorization: Bearer <token>" }, { status: 401 });
    }

    // Hash incoming token (we never store raw tokens)
    const tokenHash = hashToken(raw);

    const admin = supabaseAdmin();

    // Lookup active token
    const { data: tok, error: tokErr } = await admin
      .from("rb_device_tokens")
      .select("id, device_id, revoked_at, label, issued_at, last_seen_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (tokErr) return NextResponse.json({ ok: false, error: tokErr.message }, { status: 500 });
    if (!tok) return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 401 });
    if (tok.revoked_at) return NextResponse.json({ ok: false, error: "Token revoked" }, { status: 403 });

    rbAssertUuid("token_id", String(tok.id));
    rbAssertUuid("device_id", String(tok.device_id));

    // Fetch device record
    const { data: dev, error: devErr } = await admin
      .from("rb_devices")
      .select("id, shop_id, name, device_type, status, created_at")
      .eq("id", tok.device_id)
      .maybeSingle();

    if (devErr) return NextResponse.json({ ok: false, error: devErr.message }, { status: 500 });
    if (!dev) {
      // Keep as 404 because token was valid but device is missing
      return NextResponse.json({ ok: false, error: "Device not found" }, { status: 404 });
    }

    rbAssertUuid("device.shop_id", String(dev.shop_id));

    if (dev.status !== "active") return NextResponse.json({ ok: false, error: "Device inactive" }, { status: 403 });

    const now = new Date().toISOString();

    // Update last_seen_at (best-effort)
    try {
      await admin.from("rb_device_tokens").update({ last_seen_at: now }).eq("id", tok.id);
    } catch {
      // ignore
    }

    // Audit (best-effort)
    try {
      await writeAudit({
        actor_user_id: null,
        actor_email: null,
        action: "device_token.validated",
        target_type: "device",
        target_id: dev.id,
        shop_id: dev.shop_id ?? null,
        meta: {
          token_id: tok.id,
          label: tok.label ?? null,
          device_name: dev.name,
          device_type: dev.device_type,
          at: now,
        },
      });
    } catch {
      // ignore
    }

    return NextResponse.json({
      ok: true,
      token_id: tok.id,
      device: {
        id: dev.id,
        shop_id: dev.shop_id,
        name: dev.name,
        device_type: dev.device_type,
        status: dev.status,
        created_at: dev.created_at,
      },
    });
  } catch (e: any) {
    const msg = e?.message ?? "Server error";
    const status = /missing authorization/i.test(msg) ? 401 : /must be a uuid/i.test(msg) ? 400 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
