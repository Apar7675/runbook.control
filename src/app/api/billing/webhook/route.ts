import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getStripe, requireWebhookSecret } from "@/lib/stripe/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function updateShopBilling(
  shopId: string,
  patch: {
    stripe_customer_id?: string | null;
    stripe_subscription_id?: string | null;
    billing_status?: string | null;
    billing_current_period_end?: string | null;
  }
) {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("rb_shops")
    .update(patch)
    .eq("id", shopId)
    .select("id,name,billing_status,stripe_customer_id,stripe_subscription_id,billing_current_period_end")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function POST(req: Request) {
  try {
    const stripe = getStripe();
    const whsec = requireWebhookSecret();

    const sig = req.headers.get("stripe-signature");
    if (!sig) {
      return NextResponse.json({ ok: false, error: "Missing stripe-signature" }, { status: 400 });
    }

    const rawBody = await req.text();
    let event: any;
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, whsec);
    } catch (err: any) {
      console.error("webhook signature verify failed:", err?.message ?? err);
      return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 400 });
    }

    const type = event.type;

    if (type === "checkout.session.completed") {
      const session: any = event.data.object;

      const shopId =
        String(session.client_reference_id ?? "").trim() ||
        String(session.metadata?.shop_id ?? "").trim();

      if (!shopId) {
        console.warn("checkout.session.completed missing shop id");
        return NextResponse.json({ ok: true });
      }

      const subId = session.subscription ? String(session.subscription) : null;

      let billing_status: string | null = "active";
      let billing_current_period_end: string | null = null;

      if (subId) {
        const sub: any = await stripe.subscriptions.retrieve(subId);
        billing_status = sub.status ?? billing_status;
        billing_current_period_end = sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null;

        await stripe.subscriptions.update(sub.id, {
          metadata: { shop_id: shopId, app: "runbook.control" },
        });
      }

      await updateShopBilling(shopId, {
        stripe_customer_id: session.customer ?? null,
        stripe_subscription_id: subId,
        billing_status,
        billing_current_period_end,
      });

      return NextResponse.json({ ok: true });
    }

    if (type === "customer.subscription.updated" || type === "customer.subscription.deleted") {
      const sub: any = event.data.object;

      const shopId = String(sub.metadata?.shop_id ?? "").trim();
      if (!shopId) {
        console.warn(`${type} missing subscription.metadata.shop_id`);
        return NextResponse.json({ ok: true });
      }

      const billing_status =
        type === "customer.subscription.deleted" ? "canceled" : sub.status ?? null;

      const billing_current_period_end = sub.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString()
        : null;

      await updateShopBilling(shopId, {
        stripe_customer_id: sub.customer ?? null,
        stripe_subscription_id: sub.id ?? null,
        billing_status,
        billing_current_period_end,
      });

      return NextResponse.json({ ok: true });
    }

    // Ignore other event types
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("webhook error:", e);
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}
