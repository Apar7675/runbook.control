import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";
import { assertUuid, requirePlatformAdminAal2 } from "@/lib/authz";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function csvSafeCell(v: any) {
  // CSV injection prevention: if a cell begins with = + - @, prefix with '
  // Also escape quotes/newlines/commas correctly.
  let s = v === null || v === undefined ? "" : String(v);

  // prevent formulas
  if (s.length > 0 && /^[=+\-@]/.test(s)) s = "'" + s;

  const needs = s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r");
  if (!needs) return s;

  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    rateLimitOrThrow({ key: `audit:export:${ip}`, limit: 60, windowMs: 60_000 });

    await requirePlatformAdminAal2();

    const url = new URL(req.url);
    const sp = url.searchParams;

    const limitRaw = Number(sp.get("limit") ?? "1000");
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 5000) : 1000;

    const before = (sp.get("before") ?? "").trim();
    const shop_id = (sp.get("shop_id") ?? "").trim();
    const action = (sp.get("action") ?? "").trim();
    const actor_email = (sp.get("actor_email") ?? "").trim();
    const target_id = (sp.get("target_id") ?? "").trim();

    if (shop_id) assertUuid("shop_id", shop_id);

    const admin = supabaseAdmin();

    let q = admin
      .from("rb_audit_log")
      .select("created_at,action,shop_id,actor_email,actor_user_id,target_type,target_id,meta")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (before) q = q.lt("created_at", before);
    if (shop_id) q = q.eq("shop_id", shop_id);
    if (action) q = q.ilike("action", `%${action}%`);
    if (actor_email) q = q.ilike("actor_email", `%${actor_email}%`);
    if (target_id) q = q.ilike("target_id", `%${target_id}%`);

    const { data: rowsRaw, error } = await q;
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    const header = [
      "created_at",
      "action",
      "shop_id",
      "actor_email",
      "actor_user_id",
      "target_type",
      "target_id",
      "meta",
    ];

    const lines: string[] = [];
    lines.push(header.join(","));

    for (const r of rowsRaw ?? []) {
      lines.push(
        [
          csvSafeCell(r.created_at),
          csvSafeCell(r.action),
          csvSafeCell(r.shop_id),
          csvSafeCell(r.actor_email),
          csvSafeCell(r.actor_user_id),
          csvSafeCell(r.target_type),
          csvSafeCell(r.target_id),
          csvSafeCell(JSON.stringify(r.meta ?? {})),
        ].join(",")
      );
    }

    const filename = `runbook_audit_${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(lines.join("\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
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
