// REPLACE ENTIRE FILE: src/app/api/device/checkin/route.ts
//
// HARDENING (this pass):
// - Adds UUID tripwire for token_id/device_id.
// - Adds runtime/nodejs export.
// - Adds optional audit write (best-effort) without failing checkin.
// - Tightens status codes: 401 missing bearer, 403 invalid/revoked.
// - Keeps rate limit and best-effort device update.
//
// NOTE: This is device-to-server; no user session / billing gate here.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";
import { hashToken } from "@/lib/device/tokens";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Hardened device check-in (no anon + deviceKey).
 *
 * Request:
 *   POST /api/device/checkin
 *   Authorization: Bearer <raw device token>
 *   Body: { version?: string }
 *
 * Effects (service-role):
 *   - Updates rb_device_tokens.last_seen_at for the token
 *   - Updates rb_devices.last_seen_at and rb_devices.reported_version (if columns exist)
 *
 * Response:
 *   { ok:true, device_id, token_id }
 */

function rbAssertUuid(label: string, value: string) {
  const ok = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  if (!ok) throw new Error(`${label} must be a UUID. Got: ${value}`);
}

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    rateLimitOrThrow({ key: `device:checkin:${ip}`, limit: 600, windowMs: 60_000 });

    const auth = req.headers.get("authorization") ?? "";
    const m = auth.match(/^Bearer\s+(.+)$/i);
    const rawToken = (m?.[1] ?? "").trim();

    if (!rawToken) {
      return NextResponse.json({ ok: false, error: "Missing Authorization: Bearer <token>" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({} as any));
    const version = String((body as any)?.version ?? "").trim() || null;

    const admin = supabaseAdmin();
    const token_hash = hashToken(rawToken);

    // Find active token
    const { data: tok, error: tokErr } = await admin
      .from("rb_device_tokens")
      .select("id,device_id,revoked_at")
      .eq("token_hash", token_hash)
      .maybeSingle();

    if (tokErr) {
      return NextResponse.json({ ok: false, error: tokErr.message }, { status: 500 });
    }

    if (!tok || tok.revoked_at) {
      return NextResponse.json({ ok: false, error: "Invalid or revoked token" }, { status: 403 });
    }

    rbAssertUuid("token_id", String(tok.id));
    rbAssertUuid("device_id", String(tok.device_id));

    const now = new Date().toISOString();

    // Update token last_seen_at
    const { error: upTokErr } = await admin
      .from("rb_device_tokens")
      .update({ last_seen_at: now })
      .eq("id", tok.id);

    if (upTokErr) {
      return NextResponse.json({ ok: false, error: upTokErr.message }, { status: 500 });
    }

    // Update device last_seen/version (best-effort; schema may vary)
    // Try update with version column first; fallback to only last_seen_at.
    if (version) {
      const { error: devErr1 } = await admin
        .from("rb_devices")
        .update({ last_seen_at: now, reported_version: version })
        .eq("id", tok.device_id);

      if (devErr1) {
        const { error: devErr2 } = await admin
          .from("rb_devices")
          .update({ last_seen_at: now })
          .eq("id", tok.device_id);

        if (devErr2) {
          // Do not fail checkin if device update fails; token last_seen already updated
        }
      }
    } else {
      const { error: devErr } = await admin
        .from("rb_devices")
        .update({ last_seen_at: now })
        .eq("id", tok.device_id);

      if (devErr) {
        // Do not fail checkin if device update fails; token last_seen already updated
      }
    }

    // Best-effort audit (do not fail checkin if audit fails)
    try {
      await admin.from("rb_audit").insert({
        shop_id: null,
        actor_kind: "device",
        actor_user_id: null,
        action: "device.checkin",
        entity_type: "device",
        entity_id: tok.device_id,
        details: { token_id: tok.id, reported_version: version, at: now },
      });
    } catch {
      // ignore
    }

    return NextResponse.json({ ok: true, device_id: tok.device_id, token_id: tok.id });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    const status = /missing authorization/i.test(msg) ? 401 : /must be a uuid/i.test(msg) ? 400 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
