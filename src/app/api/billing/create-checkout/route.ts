import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const supabase = await supabaseServer();
    const { data: userRes, error: authErr } = await supabase.auth.getUser();
    if (authErr || !userRes.user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const shopId = String((body as any)?.shop_id ?? "").trim();
    if (!shopId) return NextResponse.json({ ok: false, error: "Missing shop_id" }, { status: 400 });

    const priceId = (process.env.STRIPE_PRICE_ID ?? "").trim();
    if (!priceId) return NextResponse.json({ ok: false, error: "Missing STRIPE_PRICE_ID" }, { status: 500 });

    const stripe = getStripe();

    // Determine origin for return urls (works local + prod)
    const url = new URL(req.url);
    const origin = url.origin;

    const successUrl = `${origin}/shops/${shopId}/billing?status=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${origin}/shops/${shopId}/billing?status=cancel`;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      client_reference_id: shopId,
      metadata: { shop_id: shopId, app: "runbook.control" },

      // no customer yet -> stripe will create it automatically
      line_items: [{ price: priceId, quantity: 1 }],

      success_url: successUrl,
      cancel_url: cancelUrl,

      // Recommended for tax/billing later
      // automatic_tax: { enabled: true },
    });

    if (!session.url) return NextResponse.json({ ok: false, error: "No checkout URL returned" }, { status: 500 });

    return NextResponse.json({ ok: true, url: session.url, session_id: session.id });
  } catch (e: any) {
    console.error("create-checkout error:", e);
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}
