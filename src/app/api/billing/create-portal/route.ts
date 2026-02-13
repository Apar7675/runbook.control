// REPLACE ENTIRE FILE: src/app/api/billing/create-portal/route.ts
//
// HARDENING (this pass):
// - Rate limit.
// - UUID tripwire for shop_id.
// - Authorization: caller must be shop member OR platform admin (AAL2 required).
// - Uses admin client to read rb_shops (stripe_customer_id).
// - Consistent error/status mapping.
// - Keeps Stripe billing portal behavior.
//
// NOTE: This route is part of fixing billing, so it should NOT be blocked by billing gate.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";
import { getStripe } from "@/lib/stripe/server";
import { assertUuid, requireShopAccessOrAdminAal2 } from "@/lib/authz";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    rateLimitOrThrow({ key: `billing:portal:${ip}`, limit: 60, windowMs: 60_000 });

    const body = await req.json().catch(() => ({}));
    const shopId = String((body as any)?.shop_id ?? "").trim();
    if (!shopId) return NextResponse.json({ ok: false, error: "Missing shop_id" }, { status: 400 });
    assertUuid("shop_id", shopId);

    await requireShopAccessOrAdminAal2(shopId);

    const admin = supabaseAdmin();
    const { data: shop, error } = await admin.from("rb_shops").select("id,stripe_customer_id").eq("id", shopId).single();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    if (!shop?.stripe_customer_id) {
      return NextResponse.json({ ok: false, error: "No stripe_customer_id for this shop yet." }, { status: 400 });
    }

    const stripe = getStripe();
    const url = new URL(req.url);
    const origin = url.origin;

    const portal = await stripe.billingPortal.sessions.create({
      customer: shop.stripe_customer_id,
      return_url: `${origin}/shops/${shopId}/billing`,
    });

    return NextResponse.json({ ok: true, url: portal.url });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    const status =
      /not authenticated/i.test(msg) ? 401 : /mfa required/i.test(msg) ? 403 : /access denied/i.test(msg) ? 403 : /must be a uuid/i.test(msg) ? 400 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
