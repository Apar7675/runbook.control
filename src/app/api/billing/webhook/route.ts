// REPLACE ENTIRE FILE: src/app/api/billing/webhook/route.ts
//
// FIXES (this pass):
// - Correctly sets billing_status to Stripe subscription.status (trialing/active/past_due/etc).
//   Previously it defaulted to "active" on checkout completion which is wrong for trials.
// - Period end now prefers subscription.current_period_end (always present), with invoice line fallback.
// - Keeps UUID tripwire, metadata stamping, and durable idempotency via rb_webhook_events if present.
// - Uses admin client (service role) for all DB writes.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getStripe, requireWebhookSecret } from "@/lib/stripe/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function rbAssertUuid(label: string, value: string) {
  const ok = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  if (!ok) throw new Error(`${label} must be a UUID. Got: ${value}`);
}

function isoFromSeconds(sec?: number | null): string | undefined {
  if (!sec) return undefined;
  return new Date(Number(sec) * 1000).toISOString();
}

async function updateShopBilling(
  shopId: string,
  patch: {
    stripe_customer_id?: string | null;
    stripe_subscription_id?: string | null;
    billing_status?: string | null;
    billing_current_period_end?: string | null;
  }
) {
  rbAssertUuid("shopId", shopId);
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

/**
 * Durable idempotency if you have rb_webhook_events table.
 * If not present, processing still continues (OK in dev).
 */
async function rbTryMarkWebhookEventProcessed(eventId: string): Promise<boolean> {
  const admin = supabaseAdmin();

  try {
    const { error } = await admin.from("rb_webhook_events").insert({ id: eventId });
    if (!error) return true;

    const msg = String(error.message || "").toLowerCase();
    if (msg.includes("duplicate") || msg.includes("unique")) return false;

    console.warn("rb_webhook_events insert error (non-fatal):", error.message);
    return true;
  } catch (e: any) {
    console.warn("rb_webhook_events not available (non-fatal):", e?.message ?? e);
    return true;
  }
}

function extractShopIdFromSession(session: any): string | null {
  const raw =
    String(session?.client_reference_id ?? "").trim() ||
    String(session?.metadata?.shop_id ?? "").trim();

  if (!raw) return null;
  rbAssertUuid("shopId", raw);
  return raw;
}

function extractShopIdFromSubscription(sub: any): string | null {
  const raw = String(sub?.metadata?.shop_id ?? "").trim();
  if (!raw) return null;
  rbAssertUuid("shopId", raw);
  return raw;
}

function periodEndFromExpandedSub(sub: any): string | undefined {
  // Prefer current_period_end (always present even during trial)
  const fromCpe = isoFromSeconds(sub?.current_period_end ?? null);
  if (fromCpe) return fromCpe;

  // Fallback: invoice line period end (may be missing during trial)
  const line = sub?.latest_invoice?.lines?.data?.[0];
  const invEnd = isoFromSeconds(line?.period?.end ?? null);
  return invEnd;
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

    const marked = await rbTryMarkWebhookEventProcessed(String(event.id));
    if (!marked) return NextResponse.json({ ok: true, deduped: true });

    const type = String(event.type || "");

    if (type === "checkout.session.completed") {
      const session: any = event.data.object;
      const shopId = extractShopIdFromSession(session);
      if (!shopId) return NextResponse.json({ ok: true });

      const subId = session.subscription ? String(session.subscription) : null;
      const custId = session.customer ? String(session.customer) : null;

      // Default for safety (but we will try to retrieve the subscription and use its status)
      let billing_status: string | null = "trialing";
      let nextPeriodEnd: string | undefined;

      if (subId) {
        try {
          const sub: any = await stripe.subscriptions.retrieve(subId, { expand: ["latest_invoice.lines"] });

          billing_status = sub.status ?? billing_status;
          nextPeriodEnd = periodEndFromExpandedSub(sub);

          // Ensure metadata stays stamped for future webhook events
          await stripe.subscriptions.update(sub.id, { metadata: { shop_id: shopId, app: "runbook.control" } });
        } catch (e: any) {
          console.warn("checkout.session.completed: failed to retrieve expanded subscription", e?.message ?? e);
        }
      }

      await updateShopBilling(shopId, {
        stripe_customer_id: custId,
        stripe_subscription_id: subId,
        billing_status,
        ...(nextPeriodEnd ? { billing_current_period_end: nextPeriodEnd } : {}),
      });

      return NextResponse.json({ ok: true });
    }

    if (type === "customer.subscription.created" || type === "customer.subscription.updated") {
      const subEvent: any = event.data.object;

      const shopId = extractShopIdFromSubscription(subEvent);
      if (!shopId) return NextResponse.json({ ok: true });

      let billing_status: string | null = subEvent.status ?? null;
      let nextPeriodEnd: string | undefined;

      try {
        const sub: any = await stripe.subscriptions.retrieve(String(subEvent.id), { expand: ["latest_invoice.lines"] });
        billing_status = sub.status ?? billing_status;
        nextPeriodEnd = periodEndFromExpandedSub(sub);
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

      const shopId = extractShopIdFromSubscription(subEvent);
      if (!shopId) return NextResponse.json({ ok: true });

      let nextPeriodEnd: string | undefined;
      try {
        const sub: any = await stripe.subscriptions.retrieve(String(subEvent.id), { expand: ["latest_invoice.lines"] });
        nextPeriodEnd = periodEndFromExpandedSub(sub);
      } catch {
        // ignore
      }

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
