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

/**
 * POST /api/device/checkin
 * Authorization: Bearer <raw token>
 * Body: { version?: string }
 *
 * Effects:
 * - Updates rb_device_tokens.last_seen_at
 * - Updates rb_devices.last_seen_at (+ reported_version if exists)
 */
export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    // IP limiter (pre-token)
    rateLimitOrThrow({ key: `device:checkin:ip:${ip}`, limit: 600, windowMs: 60_000 });

    const rawToken = getBearerToken(req);
    if (!rawToken) {
      return NextResponse.json({ ok: false, error: "Missing Authorization: Bearer <token>" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({} as any));
    const version = String((body as any)?.version ?? "").trim() || null;

    const admin = supabaseAdmin();
    const token_hash = hashToken(rawToken);

    // Find token by hash
    const { data: tok, error: tokErr } = await admin
      .from("rb_device_tokens")
      .select("id,device_id,revoked_at")
      .eq("token_hash", token_hash)
      .maybeSingle();

    if (tokErr) return NextResponse.json({ ok: false, error: tokErr.message }, { status: 500 });

    if (!tok) return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 401 });

    rbAssertUuid("token_id", String(tok.id));
    rbAssertUuid("device_id", String(tok.device_id));

    if (tok.revoked_at) return NextResponse.json({ ok: false, error: "Token revoked" }, { status: 403 });

    // device limiter (post-token)
    rateLimitOrThrow({ key: `device:checkin:dev:${tok.device_id}`, limit: 600, windowMs: 60_000 });

    // Enforce device status (disabled devices should not keep checking in)
    const { data: dev, error: devErr } = await admin
      .from("rb_devices")
      .select("id,shop_id,status,name,device_type")
      .eq("id", tok.device_id)
      .maybeSingle();

    if (devErr) return NextResponse.json({ ok: false, error: devErr.message }, { status: 500 });

    // If device missing, treat token as invalid (no info leak)
    if (!dev) return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 401 });

    rbAssertUuid("device.id", String(dev.id));
    rbAssertUuid("device.shop_id", String(dev.shop_id));

    if (String(dev.status ?? "").toLowerCase() !== "active") {
      return NextResponse.json({ ok: false, error: "Device inactive" }, { status: 403 });
    }

    const now = new Date().toISOString();

    // Update token last_seen_at (required)
    const { error: upTokErr } = await admin.from("rb_device_tokens").update({ last_seen_at: now }).eq("id", tok.id);
    if (upTokErr) return NextResponse.json({ ok: false, error: upTokErr.message }, { status: 500 });

    // Update device last_seen/version (best-effort schema compatibility)
    if (version) {
      const { error: devErr1 } = await admin
        .from("rb_devices")
        .update({ last_seen_at: now, reported_version: version })
        .eq("id", tok.device_id);

      if (devErr1) {
        // fallback
        await admin.from("rb_devices").update({ last_seen_at: now }).eq("id", tok.device_id);
      }
    } else {
      await admin.from("rb_devices").update({ last_seen_at: now }).eq("id", tok.device_id);
    }

    // Best-effort audit (consistent with rest of codebase)
    try {
      await writeAudit({
        actor_user_id: null,
        actor_email: null,
        action: "device.checkin",
        target_type: "device",
        target_id: tok.device_id,
        shop_id: dev.shop_id ?? null,
        meta: {
          token_id: tok.id,
          reported_version: version,
          device_name: dev.name ?? null,
          device_type: dev.device_type ?? null,
          at: now,
        },
      });
    } catch {}

    return NextResponse.json({ ok: true, device_id: tok.device_id, token_id: tok.id, at: now });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    const status =
      /missing authorization/i.test(msg) ? 401 :
      /must be a uuid/i.test(msg) ? 400 :
      500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
