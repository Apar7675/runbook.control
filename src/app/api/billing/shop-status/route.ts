import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";
import { assertUuid, requireShopAccessOrAdminAal2 } from "@/lib/authz";
import { getShopEntitlement } from "@/lib/billing/entitlement";
import { describeShopAccess } from "@/lib/billing/access";
import { SHOP_BILLING_SELECT_COLUMNS, tryExtractMissingColumn } from "@/lib/billing/manual";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function loadShopWithAutoStrip(admin: any, shopId: string) {
  const columns: string[] = [...SHOP_BILLING_SELECT_COLUMNS];

  let working = [...columns];

  for (let attempt = 0; attempt < columns.length; attempt++) {
    const { data, error } = await admin
      .from("rb_shops")
      .select(working.join(","))
      .eq("id", shopId)
      .maybeSingle();

    if (!error) return data;

    const msg = String(error.message ?? error ?? "");
    const col = tryExtractMissingColumn(msg);
    if (col && working.includes(col)) {
      working = working.filter((entry) => entry !== col);
      continue;
    }

    throw new Error(msg);
  }

  throw new Error("Select failed after stripping missing columns");
}

export async function GET(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    rateLimitOrThrow({ key: `billing:status:${ip}`, limit: 120, windowMs: 60_000 });

    const url = new URL(req.url);
    const shopId = (url.searchParams.get("shop_id") ?? "").trim();
    if (!shopId) return NextResponse.json({ ok: false, error: "Missing shop_id" }, { status: 400 });
    assertUuid("shop_id", shopId);

    const ctx = await requireShopAccessOrAdminAal2(shopId);

    const admin = supabaseAdmin();
    const shop = await loadShopWithAutoStrip(admin, shopId);

    if (!shop) return NextResponse.json({ ok: false, error: "Shop not found" }, { status: 404 });

    const entitlement = await getShopEntitlement(shopId);
    const access = describeShopAccess(entitlement);
    return NextResponse.json({ ok: true, shop, entitlement, access, admin: { is_platform_admin: ctx.isAdmin } });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    const status =
      /not authenticated/i.test(msg) ? 401
      : /mfa required/i.test(msg) ? 403
      : /access denied/i.test(msg) ? 403
      : /not a platform admin/i.test(msg) ? 403
      : /must be a uuid/i.test(msg) ? 400
      : 500;

    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
