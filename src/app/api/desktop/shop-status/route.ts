// REPLACE ENTIRE FILE: src/app/api/desktop/shop-status/route.ts
//
// Desktop polling endpoint (Bearer auth).
// - Auth: Authorization: Bearer <access_token>
// - Enforces membership (rb_shop_members) for this shop
// - Returns rb_shops billing fields directly (no forwarding to cookie-based routes)

import { NextResponse } from "next/server";
import { requireUserFromBearer } from "@/lib/desktopAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { assertUuid } from "@/lib/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { user } = await requireUserFromBearer(req);

    const url = new URL(req.url);
    const shop_id = String(url.searchParams.get("shop_id") ?? "").trim();
    if (!shop_id) return NextResponse.json({ ok: false, error: "Missing shop_id" }, { status: 400 });
    assertUuid("shop_id", shop_id);

    const admin = supabaseAdmin();

    // ✅ Must be a member of this shop (or you'll leak billing status)
    const { data: member, error: memErr } = await admin
      .from("rb_shop_members")
      .select("id, role")
      .eq("shop_id", shop_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (memErr) return NextResponse.json({ ok: false, error: memErr.message }, { status: 500 });
    if (!member) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

    const { data: shop, error } = await admin
      .from("rb_shops")
      .select("id,name,billing_status,billing_current_period_end,stripe_customer_id,stripe_subscription_id")
      .eq("id", shop_id)
      .single();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, shop });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    const status = /not authenticated/i.test(msg) ? 401 : /must be a uuid/i.test(msg) ? 400 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
