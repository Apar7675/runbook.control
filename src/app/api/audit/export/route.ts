// REPLACE ENTIRE FILE: src/app/api/audit/export/route.ts
//
// REFACTOR (this pass):
// - Uses centralized authz.ts: requirePlatformAdminAal2().
// - Adds UUID tripwire for shop filter when provided.
// - Keeps output CSV format + headers.
// - Uses admin client to read rb_audit_log (service role).
// - Keeps rate limiting.
// - Adds runtime/nodejs export + consistent error/status mapping.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";
import { assertUuid, requirePlatformAdminAal2 } from "@/lib/authz";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function csvEscape(v: any) {
  const s = v === null || v === undefined ? "" : String(v);
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
    const shop = (url.searchParams.get("shop") ?? "").trim();
    const q = (url.searchParams.get("q") ?? "").trim();
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "1000"), 1), 5000);

    if (shop) assertUuid("shop", shop);

    const admin = supabaseAdmin();

    let query = admin
      .from("rb_audit_log")
      .select("created_at,action,shop_id,rb_shops(name),actor_email,actor_user_id,target_type,target_id,meta")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (shop) query = query.eq("shop_id", shop);

    if (q) {
      const like = `%${q}%`;
      query = query.or(`action.ilike.${like},target_type.ilike.${like},actor_email.ilike.${like},target_id.ilike.${like}`);
    }

    const { data: rowsRaw, error } = await query;
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const rows = (rowsRaw ?? []).map((r: any) => ({
      created_at: r.created_at,
      action: r.action,
      shop_id: r.shop_id ?? null,
      shop_name: r?.rb_shops?.name ?? null,
      actor_email: r.actor_email ?? null,
      actor_user_id: r.actor_user_id ?? null,
      target_type: r.target_type ?? null,
      target_id: r.target_id ?? null,
      meta: r.meta ?? null,
    }));

    const header = ["created_at", "action", "shop_id", "shop_name", "actor_email", "actor_user_id", "target_type", "target_id", "meta"];

    const lines: string[] = [];
    lines.push(header.join(","));

    for (const r of rows) {
      lines.push(
        [
          csvEscape(r.created_at),
          csvEscape(r.action),
          csvEscape(r.shop_id),
          csvEscape(r.shop_name),
          csvEscape(r.actor_email),
          csvEscape(r.actor_user_id),
          csvEscape(r.target_type),
          csvEscape(r.target_id),
          csvEscape(JSON.stringify(r.meta ?? {})),
        ].join(",")
      );
    }

    const filename = `runbook_audit_${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(lines.join("\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
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
