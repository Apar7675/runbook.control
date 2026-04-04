import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/desktopAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function rankRole(role: string) {
  const normalized = String(role ?? "").trim().toLowerCase();
  if (normalized === "owner") return 0;
  if (normalized === "admin") return 1;
  return 2;
}

export async function GET(req: Request) {
  try {
    const { user } = await requireSessionUser(req);
    const admin = supabaseAdmin();

    const { data, error } = await admin
      .from("rb_shop_members")
      .select("shop_id, role, rb_shops:rb_shops(name)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    const shops = (data ?? [])
      .map((row: any) => ({
        shop_id: String(row?.shop_id ?? "").trim(),
        member_role: String(row?.role ?? "member").trim(),
        shop_name: String(row?.rb_shops?.name ?? "").trim(),
      }))
      .filter((row) => row.shop_id.length > 0);

    if (shops.length === 0) {
      return NextResponse.json({ ok: true, found: false, multiple_shops: false });
    }

    shops.sort((a, b) => {
      const roleDelta = rankRole(a.member_role) - rankRole(b.member_role);
      if (roleDelta !== 0) return roleDelta;
      return a.shop_name.localeCompare(b.shop_name);
    });

    const selected = shops[0];
    return NextResponse.json({
      ok: true,
      found: true,
      multiple_shops: shops.length > 1,
      shop_id: selected.shop_id,
      shop_name: selected.shop_name,
      member_role: selected.member_role,
    });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    const status = /not authenticated/i.test(msg) ? 401 : 400;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
