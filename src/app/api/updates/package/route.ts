import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const channel = String(body.channel ?? "stable");
    const version = String(body.version ?? "").trim();
    const notes = body.notes ? String(body.notes) : null;
    const path = String(body.path ?? "").trim();

    if (!version || !path) return NextResponse.json({ error: "Missing version or path" }, { status: 400 });

    const supabase = await supabaseServer();
    const { data: me } = await supabase.auth.getUser();
    if (!me.user?.id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { data: row, error } = await supabase.from("rb_update_packages").insert({
      channel,
      version,
      file_path: path,
      notes,
      created_by: me.user.id,
      sha256: null,
    }).select("*").single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await auditLog({
      shop_id: null,
      action: "update.package_uploaded",
      entity_type: "update",
      entity_id: row.id,
      details: { channel, version, path },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
