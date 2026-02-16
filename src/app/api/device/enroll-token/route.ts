import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";
import { writeAudit } from "@/lib/audit/writeAudit";
import { assertUuid, requirePlatformAdminAal2 } from "@/lib/authz";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function clampInt(v: any, min: number, max: number, fallback: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    rateLimitOrThrow({ key: `device:enroll_token:ip:${ip}`, limit: 60, windowMs: 60_000 });

    // AAL2 + platform admin (ap@tenmfg.com)
    const { user } = await requirePlatformAdminAal2();

    const body = await req.json().catch(() => ({}));
    const shop_id = String((body as any)?.shop_id ?? "").trim();
    const ttl_minutes = clampInt((body as any)?.ttl_minutes, 5, 24 * 60, 120); // 5..1440 default 120

    if (!shop_id) return NextResponse.json({ ok: false, error: "Missing shop_id" }, { status: 400 });
    assertUuid("shop_id", shop_id);

    rateLimitOrThrow({ key: `device:enroll_token:shop:${shop_id}`, limit: 30, windowMs: 60_000 });

    const admin = supabaseAdmin();

    // Uses the RPC we created in Supabase:
    // rb_create_device_enroll_token(p_shop_id uuid, p_ttl_minutes int) -> { ok, token, expires_at }
    const { data, error } = await admin.rpc("rb_create_device_enroll_token", {
      p_shop_id: shop_id,
      p_ttl_minutes: ttl_minutes,
    });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    if (!data?.ok) return NextResponse.json({ ok: false, error: "Token create failed" }, { status: 500 });

    // Best-effort audit
    try {
      await writeAudit({
        actor_user_id: user.id,
        actor_email: user.email ?? null,
        action: "device_enroll_token.issue",
        target_type: "shop",
        target_id: shop_id,
        shop_id,
        meta: { ttl_minutes, expires_at: data.expires_at ?? null },
      });
    } catch {}

    return NextResponse.json({ ok: true, token: data.token, expires_at: data.expires_at });
  } catch (e: any) {
    const msg = e?.message ?? "Server error";
    const status =
      /not authenticated/i.test(msg) ? 401 :
      /mfa required/i.test(msg) ? 403 :
      /not a platform admin/i.test(msg) ? 403 :
      /must be a uuid/i.test(msg) ? 400 :
      500;

    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
