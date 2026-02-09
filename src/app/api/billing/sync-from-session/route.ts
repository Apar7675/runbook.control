import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";
import { getStripe } from "@/lib/stripe/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    rateLimitOrThrow({ key: `billing:sync:${ip}`, limit: 60, windowMs: 60_000 });

    const supabase = await supabaseServer();
    const { data: userRes, error: authErr } = await supabase.auth.getUser();
    if (authErr || !userRes.user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const session_id = String((body as any)?.session_id ?? "").trim();
    if (!session_id) return NextResponse.json({ ok: false, error: "Missing session_id" }, { status: 400 });

    const stripe = getStripe();
    const session: any = await stripe.checkout.sessions.retrieve(session_id);

    const shopId =
      String(session.client_reference_id ?? "").trim() ||
      String(session.metadata?.shop_id ?? "").trim();

    if (!shopId) {
      return NextResponse.json(
        { ok: false, error: "No shop id on session (client_reference_id + metadata.shop_id empty)" },
        { status: 400 }
      );
    }

    let billing_status: string | null = "active";
    let billing_current_period_end: string | null = null;

    const subId = session.subscription ? String(session.subscription) : null;

    if (subId) {
      const sub: any = await stripe.subscriptions.retrieve(subId);
      billing_status = sub.status ?? billing_status;
      billing_current_period_end = sub.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString()
        : null;

      // Helpful for webhook follow-ups
      await stripe.subscriptions.update(sub.id, { metadata: { shop_id: shopId, app: "runbook.control" } });
    }

    const admin = supabaseAdmin();

    const { data, error } = await admin
      .from("rb_shops")
      .update({
        stripe_customer_id: session.customer ?? null,
        stripe_subscription_id: subId,
        billing_status,
        billing_current_period_end,
      })
      .eq("id", shopId)
      .select("id,name,billing_status,stripe_customer_id,stripe_subscription_id,billing_current_period_end")
      .single();

    if (error) {
      console.error("sync-from-session db update failed:", { shopId, error });
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      shop: data,
      stripe: { session_id: session.id, customer: session.customer ?? null, subscription: subId },
    });
  } catch (e: any) {
    console.error("sync-from-session error:", e);
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}
