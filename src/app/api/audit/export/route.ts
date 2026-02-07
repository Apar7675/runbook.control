import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

function csvEscape(v: any) {
  const s = v === null || v === undefined ? "" : String(v);
  const needs = s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r");
  if (!needs) return s;
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const shop = url.searchParams.get("shop") ?? "";
    const q = (url.searchParams.get("q") ?? "").trim();
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "1000"), 1), 5000);

    const supabase = await supabaseServer();
    const { data: me } = await supabase.auth.getUser();
    if (!me.user?.id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    let query = supabase
      .from("rb_audit")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (shop) query = query.eq("shop_id", shop);

    if (q) {
      const like = `%${q}%`;
      query = query.or(`action.ilike.${like},entity_type.ilike.${like},actor_kind.ilike.${like}`);
    }

    const { data: rows, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const header = [
      "created_at",
      "action",
      "shop_id",
      "actor_kind",
      "actor_user_id",
      "entity_type",
      "entity_id",
      "details",
    ];

    const lines: string[] = [];
    lines.push(header.join(","));

    for (const r of rows ?? []) {
      lines.push(
        [
          csvEscape(r.created_at),
          csvEscape(r.action),
          csvEscape(r.shop_id),
          csvEscape(r.actor_kind),
          csvEscape(r.actor_user_id),
          csvEscape(r.entity_type),
          csvEscape(r.entity_id),
          csvEscape(JSON.stringify(r.details ?? {})),
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
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
