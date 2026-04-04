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

function addGraceDays(baseIso: string | undefined, days: number): string {
  const base = baseIso ? new Date(baseIso) : new Date();
  const next = new Date(base.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString();
}

function getGraceDays(): number {
  const raw = Number.parseInt(String(process.env.RUNBOOK_BILLING_GRACE_DAYS ?? "7"), 10);
  if (!Number.isFinite(raw) || raw < 0 || raw > 90) return 7;
  return raw;
}

function computeGraceEndsAt(
  status: "trialing" | "active" | "past_due" | "canceled" | "expired",
  graceDays: number,
  nextPeriodEnd?: string
): string | null {
  if (status === "past_due") return addGraceDays(undefined, graceDays);
  if (status === "canceled") return addGraceDays(nextPeriodEnd, graceDays);
  return null;
}

function normalizeStripeStatus(status: string | null | undefined): "trialing" | "active" | "past_due" | "canceled" | "expired" {
  const s = String(status ?? "").trim().toLowerCase();
  if (s === "trialing") return "trialing";
  if (s === "active") return "active";
  if (s === "past_due" || s === "unpaid" || s === "incomplete" || s === "incomplete_expired") return "past_due";
  if (s === "canceled") return "canceled";
  return "expired";
}

function getSubscriptionPlan(sub: any): string | null {
  const priceId = sub?.items?.data?.[0]?.price?.id;
  return priceId ? String(priceId) : null;
}

async function updateShopBilling(
  shopId: string,
    patch: {
      stripe_customer_id?: string | null;
      stripe_subscription_id?: string | null;
      billing_status?: string | null;
      billing_current_period_end?: string | null;
      grace_ends_at?: string | null;
      subscription_plan?: string | null;
    }
) {
  rbAssertUuid("shopId", shopId);
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("rb_shops")
    .update(patch)
    .eq("id", shopId)
    .select("id,name,billing_status,trial_started_at,trial_ends_at,billing_current_period_end,grace_ends_at,stripe_customer_id,stripe_subscription_id,subscription_plan,entitlement_override")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

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

async function findShopIdBySubscriptionId(subscriptionId: string | null | undefined): Promise<string | null> {
  if (!subscriptionId) return null;
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("rb_shops")
    .select("id")
    .eq("stripe_subscription_id", String(subscriptionId))
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id ? String(data.id) : null;
}

function periodEndFromExpandedSub(sub: any): string | undefined {
  const fromCpe = isoFromSeconds(sub?.current_period_end ?? null);
  if (fromCpe) return fromCpe;

  const line = sub?.latest_invoice?.lines?.data?.[0];
  return isoFromSeconds(line?.period?.end ?? null);
}

export async function POST(req: Request) {
  try {
    const stripe = getStripe();
    const whsec = requireWebhookSecret();
    const graceDays = getGraceDays();

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

      let billing_status: "trialing" | "active" | "past_due" | "canceled" | "expired" = "expired";
      let nextPeriodEnd: string | undefined;
      let subscriptionPlan: string | null = null;

      if (subId) {
        try {
          const sub: any = await stripe.subscriptions.retrieve(subId, { expand: ["latest_invoice.lines", "items.data.price"] });
          billing_status = normalizeStripeStatus(sub.status);
          nextPeriodEnd = periodEndFromExpandedSub(sub);
          subscriptionPlan = getSubscriptionPlan(sub);
          await stripe.subscriptions.update(sub.id, { metadata: { shop_id: shopId, app: "runbook.control" } });
        } catch (e: any) {
          console.warn("checkout.session.completed: failed to retrieve expanded subscription", e?.message ?? e);
        }
      }

      await updateShopBilling(shopId, {
        stripe_customer_id: custId,
        stripe_subscription_id: subId,
        billing_status,
        billing_current_period_end: nextPeriodEnd,
        subscription_plan: subscriptionPlan,
        grace_ends_at: computeGraceEndsAt(billing_status, graceDays, nextPeriodEnd),
      });

      return NextResponse.json({ ok: true });
    }

    if (type === "customer.subscription.created" || type === "customer.subscription.updated") {
      const subEvent: any = event.data.object;
      const shopId = extractShopIdFromSubscription(subEvent) ?? await findShopIdBySubscriptionId(String(subEvent.id ?? ""));
      if (!shopId) return NextResponse.json({ ok: true });

      let billing_status = normalizeStripeStatus(subEvent.status ?? null);
      let nextPeriodEnd: string | undefined;
      let subscriptionPlan: string | null = null;

      try {
        const sub: any = await stripe.subscriptions.retrieve(String(subEvent.id), { expand: ["latest_invoice.lines", "items.data.price"] });
        billing_status = normalizeStripeStatus(sub.status);
        nextPeriodEnd = periodEndFromExpandedSub(sub);
        subscriptionPlan = getSubscriptionPlan(sub);
      } catch (e: any) {
        console.warn(`${type}: failed to retrieve expanded subscription`, e?.message ?? e);
      }

      await updateShopBilling(shopId, {
        stripe_customer_id: subEvent.customer ?? null,
        stripe_subscription_id: subEvent.id ?? null,
        billing_status,
        billing_current_period_end: nextPeriodEnd,
        subscription_plan: subscriptionPlan,
        grace_ends_at: computeGraceEndsAt(billing_status, graceDays, nextPeriodEnd),
      });

      return NextResponse.json({ ok: true });
    }

    if (type === "customer.subscription.deleted") {
      const subEvent: any = event.data.object;
      const shopId = extractShopIdFromSubscription(subEvent) ?? await findShopIdBySubscriptionId(String(subEvent.id ?? ""));
      if (!shopId) return NextResponse.json({ ok: true });

      let nextPeriodEnd: string | undefined;
      let subscriptionPlan: string | null = null;
      try {
        const sub: any = await stripe.subscriptions.retrieve(String(subEvent.id), { expand: ["latest_invoice.lines", "items.data.price"] });
        nextPeriodEnd = periodEndFromExpandedSub(sub);
        subscriptionPlan = getSubscriptionPlan(sub);
      } catch {
      }

      await updateShopBilling(shopId, {
        stripe_customer_id: subEvent.customer ?? null,
        stripe_subscription_id: subEvent.id ?? null,
        billing_status: "canceled",
        billing_current_period_end: nextPeriodEnd,
        subscription_plan: subscriptionPlan,
        grace_ends_at: computeGraceEndsAt("canceled", graceDays, nextPeriodEnd),
      });

      return NextResponse.json({ ok: true });
    }

    if (type === "invoice.payment_failed") {
      const invoice: any = event.data.object;
      const subscriptionId = String(invoice?.subscription ?? "").trim();
      if (!subscriptionId) return NextResponse.json({ ok: true });

      const sub: any = await stripe.subscriptions.retrieve(subscriptionId, { expand: ["latest_invoice.lines", "items.data.price"] });
      const shopId = extractShopIdFromSubscription(sub) ?? await findShopIdBySubscriptionId(subscriptionId);
      if (!shopId) return NextResponse.json({ ok: true });

      const nextPeriodEnd = periodEndFromExpandedSub(sub);
      await updateShopBilling(shopId, {
        stripe_customer_id: sub.customer ?? null,
        stripe_subscription_id: sub.id ?? null,
        billing_status: "past_due",
        billing_current_period_end: nextPeriodEnd,
        subscription_plan: getSubscriptionPlan(sub),
        grace_ends_at: computeGraceEndsAt("past_due", graceDays, nextPeriodEnd),
      });

      return NextResponse.json({ ok: true });
    }

    if (type === "invoice.payment_succeeded") {
      const invoice: any = event.data.object;
      const subscriptionId = String(invoice?.subscription ?? "").trim();
      if (!subscriptionId) return NextResponse.json({ ok: true });

      const sub: any = await stripe.subscriptions.retrieve(subscriptionId, { expand: ["latest_invoice.lines", "items.data.price"] });
      const shopId = extractShopIdFromSubscription(sub) ?? await findShopIdBySubscriptionId(subscriptionId);
      if (!shopId) return NextResponse.json({ ok: true });
      const billingStatus = normalizeStripeStatus(sub.status);
      const nextPeriodEnd = periodEndFromExpandedSub(sub);

      await updateShopBilling(shopId, {
        stripe_customer_id: sub.customer ?? null,
        stripe_subscription_id: sub.id ?? null,
        billing_status: billingStatus,
        billing_current_period_end: nextPeriodEnd,
        subscription_plan: getSubscriptionPlan(sub),
        grace_ends_at: computeGraceEndsAt(billingStatus, graceDays, nextPeriodEnd),
      });

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("webhook error:", e);
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}
