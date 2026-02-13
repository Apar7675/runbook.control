// REPLACE ENTIRE FILE: src/app/api/billing/webhook/route.ts
//
// HARDENING (this pass):
// - UUID tripwire for shopId extracted from Stripe session/metadata.
// - Idempotency guard using Stripe event.id (prevents double-processing).
//   Uses an "audit log" style table if present; otherwise falls back to in-memory no-op.
//   (You can wire this to your real audit table once you paste it.)
// - Uses admin client only (service role) for all DB writes (correct for webhooks).
// - Keeps your “period end from latest invoice line period.end” logic.
//
// NOTE: For best idempotency, create a table like:
//   public.rb_webhook_events (id text primary key, created_at timestamptz default now())
// If it doesn't exist, this code will still work, but without durable idempotency.

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
 * If not present, returns false and processing continues (still OK in dev).
 */
async function rbTryMarkWebhookEventProcessed(eventId: string): Promise<boolean> {
  const admin = supabaseAdmin();

  // Try insert into rb_webhook_events(id). If table doesn't exist, ignore.
  try {
    const { error } = await admin.from("rb_webhook_events").insert({ id: eventId });
    if (!error) return true;

    // Unique violation => already processed
    const msg = String(error.message || "");
    if (msg.toLowerCase().includes("duplicate") || msg.toLowerCase().includes("unique")) return false;

    // Other errors -> treat as non-durable, continue
    console.warn("rb_webhook_events insert error (non-fatal):", error.message);
    return true;
  } catch (e: any) {
    // Table missing or RPC error, proceed without durable idempotency
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

    // Idempotency: if already seen, no-op OK.
    const marked = await rbTryMarkWebhookEventProcessed(String(event.id));
    if (!marked) return NextResponse.json({ ok: true, deduped: true });

    const type = String(event.type || "");

    // Checkout complete: persist ids + status. Also try to resolve period end via latest invoice line period.end.
    if (type === "checkout.session.completed") {
      const session: any = event.data.object;
      const shopId = extractShopIdFromSession(session);
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

          // Ensure metadata stays stamped for future webhook events
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

    // Subscription events: update status and period end using latest invoice line period.end (authoritative).
    if (type === "customer.subscription.created" || type === "customer.subscription.updated") {
      const subEvent: any = event.data.object;

      const shopId = extractShopIdFromSubscription(subEvent);
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

      const shopId = extractShopIdFromSubscription(subEvent);
      if (!shopId) return NextResponse.json({ ok: true });

      // If we can get a last invoice period end, store it; otherwise don't overwrite.
      let nextPeriodEnd: string | undefined;
      try {
        const sub: any = await stripe.subscriptions.retrieve(String(subEvent.id), { expand: ["latest_invoice.lines"] });
        const line = sub?.latest_invoice?.lines?.data?.[0];
        const periodEndSec = line?.period?.end;
        nextPeriodEnd = isoFromSeconds(periodEndSec);
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
