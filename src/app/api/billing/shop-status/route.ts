// REPLACE ENTIRE FILE: src/app/api/billing/shop-status/route.ts
//
// REFACTOR (this pass):
// - Uses centralized authz.ts (AAL2 + shop access/admin + UUID tripwire).
// - Keeps rate limit.
// - Uses admin client to read rb_shops billing fields only.
// - Consistent error/status mapping.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";
import { assertUuid, requireShopAccessOrAdminAal2 } from "@/lib/authz";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    rateLimitOrThrow({ key: `billing:status:${ip}`, limit: 120, windowMs: 60_000 });

    const url = new URL(req.url);
    const shopId = (url.searchParams.get("shop_id") ?? "").trim();
    if (!shopId) return NextResponse.json({ ok: false, error: "Missing shop_id" }, { status: 400 });
    assertUuid("shop_id", shopId);

    await requireShopAccessOrAdminAal2(shopId);

    const admin = supabaseAdmin();
    const { data: shop, error } = await admin
      .from("rb_shops")
      .select("billing_status,billing_current_period_end,stripe_customer_id,stripe_subscription_id")
      .eq("id", shopId)
      .maybeSingle();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    if (!shop) return NextResponse.json({ ok: false, error: "Shop not found" }, { status: 404 });

    return NextResponse.json({ ok: true, shop });
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
