import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/desktopAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { assertUuid } from "@/lib/authz";
import { listDesktopShopLinksForDevice } from "@/lib/desktop/shopDeviceTrust";

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
    const url = new URL(req.url);
    const deviceId = String(url.searchParams.get("device_id") ?? "").trim();

    if (deviceId)
      assertUuid("device_id", deviceId);

    const { data, error } = await admin
      .from("rb_shop_members")
      .select("shop_id, role, rb_shops:rb_shops(name)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    const links = deviceId
      ? await listDesktopShopLinksForDevice(admin, deviceId)
      : [];
    const linksByShop = new Map(
      links
        .filter(link => link.shop_id)
        .map(link => [String(link.shop_id).trim(), link] as const));

    const shops = (data ?? [])
      .map((row: any) => {
        const shopId = String(row?.shop_id ?? "").trim();
        const link = linksByShop.get(shopId);
        return {
          shop_id: shopId,
          member_role: String(row?.role ?? "member").trim(),
          shop_name: String(row?.rb_shops?.name ?? "").trim(),
          is_linked_to_device: !!link?.device_id,
          device_role: String(link?.device_role ?? "").trim(),
        };
      })
      .filter((row) => row.shop_id.length > 0);

    if (shops.length === 0) {
      return NextResponse.json({
        ok: true,
        found: false,
        multiple_shops: false,
        shops: [],
        available_shops: [],
        company_shops: [],
      });
    }

    shops.sort((a, b) => {
      const linkedDelta = Number(b.is_linked_to_device) - Number(a.is_linked_to_device);
      if (linkedDelta !== 0) return linkedDelta;

      const roleDelta = rankRole(a.member_role) - rankRole(b.member_role);
      if (roleDelta !== 0) return roleDelta;

      return a.shop_name.localeCompare(b.shop_name);
    });

    const selected = shops[0];
    const responseShops = shops.map((shop) => ({
      ...shop,
      is_current: shop.shop_id === selected.shop_id,
    }));

    return NextResponse.json({
      ok: true,
      found: true,
      multiple_shops: shops.length > 1,
      shop_id: selected.shop_id,
      shop_name: selected.shop_name,
      member_role: selected.member_role,
      shops: responseShops,
      available_shops: responseShops,
      company_shops: responseShops,
    });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    const status = /not authenticated/i.test(msg) ? 401 : /must be a uuid/i.test(msg) ? 400 : 400;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
