import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/desktopAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { assertUuid } from "@/lib/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getShopMembership(admin: any, shopId: string, userId: string) {
  const { data, error } = await admin
    .from("rb_shop_members")
    .select("id")
    .eq("shop_id", shopId)
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error("Access denied");
}

export async function GET(req: Request) {
  try {
    const { user } = await requireSessionUser(req);
    const url = new URL(req.url);
    const shopId = String(url.searchParams.get("shop_id") ?? "").trim();
    if (!shopId) return NextResponse.json({ ok: false, error: "Missing shop_id" }, { status: 400 });
    assertUuid("shop_id", shopId);

    const admin = supabaseAdmin();
    await getShopMembership(admin, shopId, user.id);

    const { data, error } = await admin
      .from("rb_devices")
      .select("id,shop_id,name,device_type,status")
      .eq("shop_id", shopId)
      .eq("device_type", "workstation")
      .order("name", { ascending: true });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, shop_id: shopId, workstations: data ?? [] });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    const status = /not authenticated/i.test(msg) ? 401 : /access denied/i.test(msg) ? 403 : /must be a uuid/i.test(msg) ? 400 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

