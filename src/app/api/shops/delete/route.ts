import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const shopId = String(body.shopId ?? "").trim();
    const confirmName = String(body.confirmName ?? "").trim();

    if (!shopId) return NextResponse.json({ error: "Missing shopId" }, { status: 400 });

    const supabase = await supabaseServer();
    const { data: me } = await supabase.auth.getUser();
    if (!me.user?.id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    // Fetch shop (RLS select requires membership)
    const { data: shop, error: e0 } = await supabase
      .from("rb_shops")
      .select("id,name")
      .eq("id", shopId)
      .single();

    if (e0) return NextResponse.json({ error: e0.message }, { status: 500 });

    if (confirmName !== shop.name) {
      return NextResponse.json({ error: "Confirmation name did not match." }, { status: 400 });
    }

    // Delete (RLS delete requires admin)
    const { error: e1 } = await supabase.from("rb_shops").delete().eq("id", shopId);
    if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });

    await auditLog({
      shop_id: shopId,
      action: "shop.deleted",
      entity_type: "shop",
      entity_id: shopId,
      details: { name: shop.name },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
