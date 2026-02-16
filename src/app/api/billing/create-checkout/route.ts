// REPLACE ENTIRE FILE: src/app/api/billing/create-checkout/route.ts
//
// Best UX for Desktop:
// - Stripe success/cancel land on PUBLIC pages (/billing/complete, /billing/cancel)
// - Supports Desktop Bearer token auth + Browser session auth
// - Supports GET (?shop_id=) and POST ({ shop_id })

import { NextResponse } from "next/server";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";
import { getStripe } from "@/lib/stripe/server";
import { assertUuid, requireShopAccessOrAdminAal2 } from "@/lib/authz";
import { requireUserFromBearer } from "@/lib/desktopAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TRIAL_DAYS = 30;

function getIp(req: Request) {
  return req.headers.get("x-forwarded-for") ?? "local";
}

function getOrigin(req: Request) {
  return new URL(req.url).origin;
}

async function authenticate(req: Request, shopId: string) {
  const authHeader = req.headers.get("authorization");

  // Desktop flow (Bearer token)
  if (authHeader?.startsWith("Bearer ")) {
    const { user } = await requireUserFromBearer(req);
    if (!user?.id) throw new Error("Invalid bearer token");
    return;
  }

  // Browser flow (Control UI session)
  await requireShopAccessOrAdminAal2(shopId);
}

async function createCheckout(req: Request, shopIdRaw: string) {
  const shopId = String(shopIdRaw ?? "").trim();
  if (!shopId) return NextResponse.json({ ok: false, error: "Missing shop_id" }, { status: 400 });
  assertUuid("shop_id", shopId);

  await authenticate(req, shopId);

  const priceId = (process.env.STRIPE_PRICE_ID ?? "").trim();
  if (!priceId) return NextResponse.json({ ok: false, error: "Missing STRIPE_PRICE_ID" }, { status: 500 });

  const stripe = getStripe();
  const origin = getOrigin(req);

  // ✅ Public landing pages (NOT behind auth)
  const successUrl = `${origin}/billing/complete?shop_id=${shopId}&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${origin}/billing/cancel?shop_id=${shopId}`;

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

  if (!session.url) return NextResponse.json({ ok: false, error: "Stripe did not return URL" }, { status: 500 });

  return NextResponse.json({ ok: true, url: session.url, session_id: session.id, trial_days: TRIAL_DAYS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

export async function GET(req: Request) {
  try {
    rateLimitOrThrow({ key: `billing:checkout:${getIp(req)}`, limit: 60, windowMs: 60_000 });
    const url = new URL(req.url);
    return await createCheckout(req, url.searchParams.get("shop_id") ?? "");
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    const status = /not authenticated|invalid bearer/i.test(msg) ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

export async function POST(req: Request) {
  try {
    rateLimitOrThrow({ key: `billing:checkout:${getIp(req)}`, limit: 60, windowMs: 60_000 });
    const body = await req.json().catch(() => ({}));
    return await createCheckout(req, String((body as any)?.shop_id ?? ""));
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    const status = /not authenticated|invalid bearer/i.test(msg) ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
