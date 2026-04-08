import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireSessionUser } from "@/lib/desktopAuth";
import { assertUuid } from "@/lib/authz";
import { loadDesktopShopLink, upsertDesktopShopLink } from "@/lib/desktop/shopDeviceTrust";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { user } = await requireSessionUser(req);
    const body = await req.json().catch(() => ({}));
    const shop_id = String(body.shop_id ?? "").trim();
    const device_id = String(body.device_id ?? "").trim();

    if (!shop_id) return NextResponse.json({ ok: false, error: "Missing shop_id" }, { status: 400 });
    if (!device_id) return NextResponse.json({ ok: false, error: "Missing device_id" }, { status: 400 });
    assertUuid("shop_id", shop_id);
    assertUuid("device_id", device_id);

    const admin = supabaseAdmin();
    const { data: mem } = await admin
      .from("rb_shop_members")
      .select("role")
      .eq("shop_id", shop_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!mem) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

    const existing = await loadDesktopShopLink(admin, shop_id, device_id);
    const link = await upsertDesktopShopLink(admin, {
      shopId: shop_id,
      deviceId: device_id,
      deviceName: `RunBook Desktop (${device_id.slice(0, 8)})`,
      status: "active",
      deviceRole: existing?.device_role ?? "",
    });

    return NextResponse.json({
      ok: true,
      existing: !!existing?.device_id,
      linked: !!link?.device_id,
      device_id,
      shop_id,
      status: String(link?.status ?? "active").trim(),
      device_role: String(link?.device_role ?? "").trim(),
    });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    const status = /not authenticated/i.test(msg) ? 401 : /access denied/i.test(msg) ? 403 : /must be a uuid/i.test(msg) ? 400 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
