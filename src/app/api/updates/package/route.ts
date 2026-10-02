import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";
import { isPlatformAdmin, requireAal2 } from "@/lib/authz";

export async function POST(req: Request) {
  try {
    const { user } = await requireAal2();
    if (!(await isPlatformAdmin(user.id))) {
      console.warn(`[Auth] updates/package blocked: user=${user.id} reason=platform_admin_required`);
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const channel = String(body.channel ?? "stable");
    const version = String(body.version ?? "").trim();
    const notes = body.notes ? String(body.notes) : null;
    const path = String(body.path ?? "").trim();

    if (!version || !path) return NextResponse.json({ error: "Missing version or path" }, { status: 400 });

    const supabase = await supabaseServer();

    const { data: row, error } = await supabase.from("rb_update_packages").insert({
      channel,
      version,
      file_path: path,
      notes,
      created_by: user.id,
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
    const msg = e?.message ?? String(e);
    const status =
      /not authenticated/i.test(msg) ? 401 :
      /mfa required|not a platform admin/i.test(msg) ? 403 :
      500;
    return NextResponse.json({ error: status === 500 ? msg : "Forbidden" }, { status });
  }
}
