// REPLACE ENTIRE FILE: src/app/api/device/validate-token/route.ts

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";
import { writeAudit } from "@/lib/audit/writeAudit";
import { hashToken } from "@/lib/device/tokens";

export const dynamic = "force-dynamic";

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

    // Fetch device record
    const { data: dev, error: devErr } = await admin
      .from("rb_devices")
      .select("id, shop_id, name, device_type, status, created_at")
      .eq("id", tok.device_id)
      .maybeSingle();

    if (devErr) return NextResponse.json({ ok: false, error: devErr.message }, { status: 500 });
    if (!dev) return NextResponse.json({ ok: false, error: "Device not found" }, { status: 404 });
    if (dev.status !== "active") return NextResponse.json({ ok: false, error: "Device inactive" }, { status: 403 });

    // Update last_seen_at (best-effort)
    await admin
      .from("rb_device_tokens")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", tok.id);

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
        },
      });
    } catch {
      // ignore audit failures
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
    return NextResponse.json({ ok: false, error: e?.message ?? "Server error" }, { status: 500 });
  }
}
