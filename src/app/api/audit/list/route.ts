import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";

export const dynamic = "force-dynamic";

/**
 * GET /api/audit/list
 * Query params:
 *   limit=number (default 200, max 500)
 *   before=ISO timestamp (optional pagination, returns rows < before)
 *   shop_id=uuid (optional)
 *   action=string (optional substring match)
 *   actor_email=string (optional substring match)
 *   target_id=string (optional substring match)
 *
 * Returns:
 *   { ok:true, rows: AuditRow[] }
 *   or { ok:false, error }
 */
export async function GET(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    rateLimitOrThrow({ key: `audit:list:${ip}`, limit: 120, windowMs: 60_000 });

    const supabase = await supabaseServer();

    // Auth
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes.user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }
    const user = userRes.user;

    // AAL2
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const aal = (aalData?.currentLevel as "aal1" | "aal2" | "aal3" | null) ?? "aal1";
    if (aal !== "aal2") return NextResponse.json({ ok: false, error: "MFA required (AAL2)" }, { status: 403 });

    // Platform admin
    const { data: adminRow } = await supabase
      .from("rb_control_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!adminRow) return NextResponse.json({ ok: false, error: "Not a platform admin" }, { status: 403 });

    const url = new URL(req.url);
    const sp = url.searchParams;

    const limitRaw = Number(sp.get("limit") ?? "200");
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 200;

    const before = (sp.get("before") ?? "").trim();
    const shop_id = (sp.get("shop_id") ?? "").trim();
    const action = (sp.get("action") ?? "").trim();
    const actor_email = (sp.get("actor_email") ?? "").trim();
    const target_id = (sp.get("target_id") ?? "").trim();

    const admin = supabaseAdmin();

    // Include shop name via FK relation if available (rb_audit_log.shop_id -> rb_shops.id)
    let q = admin
      .from("rb_audit_log")
      .select("id,created_at,actor_user_id,actor_email,action,target_type,target_id,shop_id,meta, rb_shops(name)")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (before) q = q.lt("created_at", before);

    if (shop_id) q = q.eq("shop_id", shop_id);
    if (action) q = q.ilike("action", `%${action}%`);
    if (actor_email) q = q.ilike("actor_email", `%${actor_email}%`);
    if (target_id) q = q.ilike("target_id", `%${target_id}%`);

    const { data: rowsRaw, error } = await q;
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    const rows = (rowsRaw ?? []).map((r: any) => ({
      id: r.id,
      created_at: r.created_at,
      actor_user_id: r.actor_user_id ?? null,
      actor_email: r.actor_email ?? null,
      action: r.action,
      target_type: r.target_type ?? null,
      target_id: r.target_id ?? null,
      shop_id: r.shop_id ?? null,
      shop_name: r?.rb_shops?.name ?? null,
      meta: r.meta ?? null,
    }));

    return NextResponse.json({ ok: true, rows });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Server error" }, { status: 500 });
  }
}
