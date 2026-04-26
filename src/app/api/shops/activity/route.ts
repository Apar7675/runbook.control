import { NextResponse } from "next/server";
import { assertUuid, requireShopAccessOrAdminAal2 } from "@/lib/authz";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function text(value: unknown) {
  return String(value ?? "").trim();
}

export async function GET(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    rateLimitOrThrow({ key: `shops:activity:${ip}`, limit: 120, windowMs: 60_000 });

    const url = new URL(req.url);
    const shopId = text(url.searchParams.get("shop_id"));
    const limitRaw = Number(url.searchParams.get("limit") ?? "8");
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 8;

    if (!shopId) return NextResponse.json({ ok: false, error: "Missing shop_id" }, { status: 400 });
    assertUuid("shop_id", shopId);

    await requireShopAccessOrAdminAal2(shopId);

    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("rb_audit_log")
      .select("id,created_at,actor_user_id,actor_email,action,target_type,target_id,meta")
      .eq("shop_id", shopId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    return NextResponse.json({
      ok: true,
      rows: (data ?? []).map((row: any) => ({
        id: row.id,
        created_at: row.created_at,
        actor_user_id: row.actor_user_id ?? null,
        actor_email: row.actor_email ?? null,
        action: row.action,
        target_type: row.target_type ?? null,
        target_id: row.target_id ?? null,
        meta: row.meta ?? null,
      })),
    });
  } catch (e: any) {
    const msg = e?.message ?? "Server error";
    const status =
      /not authenticated/i.test(msg) ? 401
      : /mfa required/i.test(msg) ? 403
      : /access denied/i.test(msg) ? 403
      : /must be a uuid/i.test(msg) ? 400
      : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
