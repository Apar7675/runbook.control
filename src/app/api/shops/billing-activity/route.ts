import { NextResponse } from "next/server";
import { assertUuid, requirePlatformAdminAal2 } from "@/lib/authz";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    rateLimitOrThrow({ key: `billing:activity:${ip}`, limit: 120, windowMs: 60_000 });

    await requirePlatformAdminAal2();

    const url = new URL(req.url);
    const shopId = String(url.searchParams.get("shop_id") ?? "").trim();
    const limitRaw = Number(url.searchParams.get("limit") ?? "12");
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 40) : 12;

    if (!shopId) {
      return NextResponse.json({ ok: false, error: "Missing shop_id" }, { status: 400 });
    }

    assertUuid("shop_id", shopId);

    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("rb_audit_log")
      .select("id,created_at,actor_user_id,actor_email,actor_kind,action,target_type,target_id,shop_id,meta")
      .eq("shop_id", shopId)
      .ilike("action", "billing.%")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      ok: true,
      shop_id: shopId,
      rows: (data ?? []).map((row: any) => ({
        id: row.id,
        created_at: row.created_at,
        actor_user_id: row.actor_user_id ?? null,
        actor_email: row.actor_email ?? null,
        actor_kind: row.actor_kind ?? null,
        action: row.action,
        target_type: row.target_type ?? null,
        target_id: row.target_id ?? null,
        shop_id: row.shop_id ?? null,
        meta: row.meta ?? {},
      })),
    });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    const status =
      /not authenticated/i.test(msg) ? 401
      : /mfa required/i.test(msg) ? 403
      : /not a platform admin/i.test(msg) ? 403
      : /must be a uuid/i.test(msg) ? 400
      : 500;

    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
