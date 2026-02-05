import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const shopId = String(body.shopId ?? "").trim();
    const notes = body.notes ? String(body.notes) : null;
    const path = String(body.path ?? "").trim();

    if (!shopId || !path) return NextResponse.json({ error: "Missing shopId or path" }, { status: 400 });

    const supabase = await supabaseServer();
    const { data: me } = await supabase.auth.getUser();
    if (!me.user?.id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { error } = await supabase.from("rb_support_bundles").insert({
      shop_id: shopId,
      file_path: path,
      notes,
      uploaded_by: me.user.id,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
