import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";
import { assertUuid, requirePlatformAdminAal2 } from "@/lib/authz";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/audit/list
 *
 * Query params:
 *   limit (default 200, max 500)
 *   before (ISO pagination)
 *   shop_id (uuid)
 *   action (substring)
 *   actor_email (substring)
 *   target_id (substring)
 *
 * Returns:
 *   { ok:true, rows: AuditRow[] }
 */
export async function GET(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    rateLimitOrThrow({ key: `audit:list:${ip}`, limit: 120, windowMs: 60_000 });

    await requirePlatformAdminAal2();

    const url = new URL(req.url);
    const sp = url.searchParams;

    const limitRaw = Number(sp.get("limit") ?? "200");
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(limitRaw, 1), 500)
      : 200;

    const before = (sp.get("before") ?? "").trim();
    const shop_id = (sp.get("shop_id") ?? "").trim();
    const action = (sp.get("action") ?? "").trim();
    const actor_email = (sp.get("actor_email") ?? "").trim();
    const target_id = (sp.get("target_id") ?? "").trim();

    if (shop_id) assertUuid("shop_id", shop_id);

    const admin = supabaseAdmin();

    let q = admin
      .from("rb_audit_log")
      .select("id,created_at,actor_user_id,actor_email,action,target_type,target_id,shop_id,meta")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (before) q = q.lt("created_at", before);
    if (shop_id) q = q.eq("shop_id", shop_id);
    if (action) q = q.ilike("action", `%${action}%`);
    if (actor_email) q = q.ilike("actor_email", `%${actor_email}%`);
    if (target_id) q = q.ilike("target_id", `%${target_id}%`);

    const { data: rowsRaw, error } = await q;
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const rows = (rowsRaw ?? []).map((r: any) => ({
      id: r.id,
      created_at: r.created_at,
      actor_user_id: r.actor_user_id ?? null,
      actor_email: r.actor_email ?? null,
      action: r.action,
      target_type: r.target_type ?? null,
      target_id: r.target_id ?? null,
      shop_id: r.shop_id ?? null,
      meta: r.meta ?? null,
    }));

    return NextResponse.json({ ok: true, rows });
  } catch (e: any) {
    const msg = e?.message ?? "Server error";
    const status =
      /not authenticated/i.test(msg) ? 401
      : /mfa required/i.test(msg) ? 403
      : /not a platform admin/i.test(msg) ? 403
      : /must be a uuid/i.test(msg) ? 400
      : 500;

    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
