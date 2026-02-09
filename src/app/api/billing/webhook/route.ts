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

function isoFromSeconds(sec?: number | null): string | undefined {
  if (!sec) return undefined;
  return new Date(Number(sec) * 1000).toISOString();
}

export async function POST(req: Request) {
  try {
    const stripe = getStripe();
    const whsec = requireWebhookSecret();

    const sig = req.headers.get("stripe-signature");
    if (!sig) return NextResponse.json({ ok: false, error: "Missing stripe-signature" }, { status: 400 });

    const rawBody = await req.text();
    let event: any;

    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, whsec);
    } catch (err: any) {
      console.error("webhook signature verify failed:", err?.message ?? err);
      return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 400 });
    }

    const type = event.type;

    // Checkout complete: persist ids + status. Also try to resolve period end via latest invoice lines (most reliable on your account).
    if (type === "checkout.session.completed") {
      const session: any = event.data.object;

      const shopId =
        String(session.client_reference_id ?? "").trim() ||
        String(session.metadata?.shop_id ?? "").trim();

      if (!shopId) return NextResponse.json({ ok: true });

      const subId = session.subscription ? String(session.subscription) : null;

      let billing_status: string | null = "active";
      let nextPeriodEnd: string | undefined;

      if (subId) {
        try {
          const sub: any = await stripe.subscriptions.retrieve(subId, { expand: ["latest_invoice.lines"] });
          billing_status = sub.status ?? billing_status;

          const line = sub?.latest_invoice?.lines?.data?.[0];
          const periodEndSec = line?.period?.end;
          nextPeriodEnd = isoFromSeconds(periodEndSec);

          await stripe.subscriptions.update(sub.id, { metadata: { shop_id: shopId, app: "runbook.control" } });
        } catch (e: any) {
          console.warn("checkout.session.completed: failed to retrieve expanded subscription", e?.message ?? e);
        }
      }

      await updateShopBilling(shopId, {
        stripe_customer_id: session.customer ?? null,
        stripe_subscription_id: subId,
        billing_status,
        ...(nextPeriodEnd ? { billing_current_period_end: nextPeriodEnd } : {}),
      });

      return NextResponse.json({ ok: true });
    }

    // Subscription events: update status and period end using latest invoice lines (authoritative).
    if (type === "customer.subscription.created" || type === "customer.subscription.updated") {
      const subEvent: any = event.data.object;

      const shopId = String(subEvent?.metadata?.shop_id ?? "").trim();
      if (!shopId) return NextResponse.json({ ok: true });

      let billing_status: string | null = subEvent.status ?? null;
      let nextPeriodEnd: string | undefined;

      try {
        const sub: any = await stripe.subscriptions.retrieve(String(subEvent.id), { expand: ["latest_invoice.lines"] });
        billing_status = sub.status ?? billing_status;

        const line = sub?.latest_invoice?.lines?.data?.[0];
        const periodEndSec = line?.period?.end;
        nextPeriodEnd = isoFromSeconds(periodEndSec);
      } catch (e: any) {
        console.warn(`${type}: failed to retrieve expanded subscription`, e?.message ?? e);
      }

      await updateShopBilling(shopId, {
        stripe_customer_id: subEvent.customer ?? null,
        stripe_subscription_id: subEvent.id ?? null,
        billing_status,
        ...(nextPeriodEnd ? { billing_current_period_end: nextPeriodEnd } : {}),
      });

      return NextResponse.json({ ok: true });
    }

    if (type === "customer.subscription.deleted") {
      const subEvent: any = event.data.object;

      const shopId = String(subEvent?.metadata?.shop_id ?? "").trim();
      if (!shopId) return NextResponse.json({ ok: true });

      // If we can get a last invoice period end, store it; otherwise don't overwrite.
      let nextPeriodEnd: string | undefined;
      try {
        const sub: any = await stripe.subscriptions.retrieve(String(subEvent.id), { expand: ["latest_invoice.lines"] });
        const line = sub?.latest_invoice?.lines?.data?.[0];
        const periodEndSec = line?.period?.end;
        nextPeriodEnd = isoFromSeconds(periodEndSec);
      } catch {}

      await updateShopBilling(shopId, {
        stripe_customer_id: subEvent.customer ?? null,
        stripe_subscription_id: subEvent.id ?? null,
        billing_status: "canceled",
        ...(nextPeriodEnd ? { billing_current_period_end: nextPeriodEnd } : {}),
      });

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("webhook error:", e);
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}
