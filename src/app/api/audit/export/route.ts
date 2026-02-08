import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";

export const dynamic = "force-dynamic";

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

    const url = new URL(req.url);
    const shop = (url.searchParams.get("shop") ?? "").trim();
    const q = (url.searchParams.get("q") ?? "").trim();
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "1000"), 1), 5000);

    const supabase = await supabaseServer();

    const { data: userRes, error: authErr } = await supabase.auth.getUser();
    if (authErr || !userRes.user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }
    const user = userRes.user;

    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const aal = (aalData?.currentLevel as "aal1" | "aal2" | "aal3" | null) ?? "aal1";
    if (aal !== "aal2") {
      return NextResponse.json({ ok: false, error: "MFA required (AAL2)" }, { status: 403 });
    }

    const { data: adminRow } = await supabase
      .from("rb_control_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!adminRow) {
      return NextResponse.json({ ok: false, error: "Not a platform admin" }, { status: 403 });
    }

    const admin = supabaseAdmin();

    let query = admin
      .from("rb_audit_log")
      .select("created_at,action,shop_id,rb_shops(name),actor_email,actor_user_id,target_type,target_id,meta")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (shop) query = query.eq("shop_id", shop);

    if (q) {
      const like = `%${q}%`;
      query = query.or(
        `action.ilike.${like},target_type.ilike.${like},actor_email.ilike.${like},target_id.ilike.${like}`
      );
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

    const header = [
      "created_at",
      "action",
      "shop_id",
      "shop_name",
      "actor_email",
      "actor_user_id",
      "target_type",
      "target_id",
      "meta",
    ];

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
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}
