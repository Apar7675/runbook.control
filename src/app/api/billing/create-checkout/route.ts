import { NextResponse } from "next/server";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";
import { getStripe } from "@/lib/stripe/server";
import { assertUuid, requireShopAccessOrAdminAal2 } from "@/lib/authz";
import { requireSessionUser } from "@/lib/desktopAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TRIAL_DAYS = 30;
const SHOP_TABLE = "rb_shops";

function getIp(req: Request) {
  return req.headers.get("x-forwarded-for") ?? "local";
}

function getOrigin(req: Request) {
  return new URL(req.url).origin;
}

async function authenticate(req: Request, shopId: string) {
  const authHeader = req.headers.get("authorization");

  if (authHeader?.startsWith("Bearer ")) {
    const { user } = await requireSessionUser(req);
    if (!user?.id) throw new Error("Invalid bearer token");
    return;
  }

  await requireShopAccessOrAdminAal2(shopId);
}

async function loadShop(shopId: string) {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from(SHOP_TABLE)
    .select("id,billing_status,trial_started_at,trial_ends_at,trial_restricted,trial_eligibility_reason,trial_consumed_at")
    .eq("id", shopId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error("Shop not found");
  return data;
}

function resolveTrialConfiguration(shop: any) {
  const trialRestricted = Boolean(shop?.trial_restricted);
  const billingStatus = String(shop?.billing_status ?? "").trim().toLowerCase();
  const trialEndsAt = String(shop?.trial_ends_at ?? "").trim();
  const trialStartedAt = String(shop?.trial_started_at ?? "").trim();
  const trialConsumedAt = String(shop?.trial_consumed_at ?? "").trim();

  if (trialRestricted || billingStatus === "restricted") {
    return { mode: "no_trial" as const, trialEndEpoch: null };
  }

  if (trialEndsAt) {
    const epoch = Math.floor(new Date(trialEndsAt).getTime() / 1000);
    if (Number.isFinite(epoch) && epoch > Math.floor(Date.now() / 1000) + 60) {
      return { mode: "existing_trial_end" as const, trialEndEpoch: epoch };
    }
  }

  if (trialStartedAt || trialConsumedAt) {
    return { mode: "no_trial" as const, trialEndEpoch: null };
  }

  return { mode: "new_trial_days" as const, trialEndEpoch: null };
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
  const shop = await loadShop(shopId);
  const trialConfig = resolveTrialConfiguration(shop);

  const successUrl = `${origin}/billing/complete?shop_id=${shopId}&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${origin}/billing/cancel?shop_id=${shopId}`;

  const subscriptionData: Record<string, any> = {
    metadata: { shop_id: shopId, app: "runbook.control" },
  };

  if (trialConfig.mode === "existing_trial_end" && trialConfig.trialEndEpoch) {
    subscriptionData.trial_end = trialConfig.trialEndEpoch;
  } else if (trialConfig.mode === "new_trial_days") {
    subscriptionData.trial_period_days = TRIAL_DAYS;
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    client_reference_id: shopId,
    metadata: { shop_id: shopId, app: "runbook.control" },
    line_items: [{ price: priceId, quantity: 1 }],
    payment_method_collection: "always",
    subscription_data: subscriptionData,
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  if (!session.url) return NextResponse.json({ ok: false, error: "Stripe did not return URL" }, { status: 500 });

  return NextResponse.json({
    ok: true,
    url: session.url,
    session_id: session.id,
    trial_days: trialConfig.mode === "new_trial_days" ? TRIAL_DAYS : 0,
    trial_mode: trialConfig.mode,
    trial_eligibility_reason: shop?.trial_eligibility_reason ?? null,
  });
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
