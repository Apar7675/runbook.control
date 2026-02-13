// REPLACE ENTIRE FILE: src/app/api/billing/create-checkout/route.ts
//
// REFACTOR (this pass):
// - Uses centralized authz.ts (AAL2 + shop access/admin + UUID tripwire).
// - Keeps rate limit + TRIAL checkout behavior + metadata stamping.
// - No billing-gate enforcement here (this route is how billing gets fixed).

import { NextResponse } from "next/server";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";
import { getStripe } from "@/lib/stripe/server";
import { assertUuid, requireShopAccessOrAdminAal2 } from "@/lib/authz";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TRIAL_DAYS = 30;

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    rateLimitOrThrow({ key: `billing:checkout:${ip}`, limit: 60, windowMs: 60_000 });

    const body = await req.json().catch(() => ({}));
    const shopId = String((body as any)?.shop_id ?? "").trim();
    if (!shopId) return NextResponse.json({ ok: false, error: "Missing shop_id" }, { status: 400 });
    assertUuid("shop_id", shopId);

    // Requires AAL2 + (shop member OR platform admin)
    await requireShopAccessOrAdminAal2(shopId);

    const priceId = (process.env.STRIPE_PRICE_ID ?? "").trim();
    if (!priceId) return NextResponse.json({ ok: false, error: "Missing STRIPE_PRICE_ID" }, { status: 500 });

    const stripe = getStripe();

    const url = new URL(req.url);
    const origin = url.origin;

    const successUrl = `${origin}/shops/${shopId}/billing?status=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${origin}/shops/${shopId}/billing?status=cancel`;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      client_reference_id: shopId,
      metadata: { shop_id: shopId, app: "runbook.control" },

      line_items: [{ price: priceId, quantity: 1 }],

      payment_method_collection: "always",

      subscription_data: {
        trial_period_days: TRIAL_DAYS,
        metadata: { shop_id: shopId, app: "runbook.control" },
      },

      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    if (!session.url) return NextResponse.json({ ok: false, error: "No checkout URL returned" }, { status: 500 });

    return NextResponse.json({ ok: true, url: session.url, session_id: session.id, trial_days: TRIAL_DAYS });
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
