import { NextResponse } from "next/server";
import { assertUuid, requirePlatformAdminAal2 } from "@/lib/authz";
import { writeAudit } from "@/lib/audit/writeAudit";
import { describeShopAccess } from "@/lib/billing/access";
import { getShopEntitlement } from "@/lib/billing/entitlement";
import { SHOP_BILLING_SELECT_COLUMNS } from "@/lib/billing/manual";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";
import { getStripe } from "@/lib/stripe/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function text(value: unknown) {
  return String(value ?? "").trim();
}

function isoFromSeconds(value?: number | null) {
  if (!value) return null;
  return new Date(Number(value) * 1000).toISOString();
}

function normalizeStripeStatus(status: string | null | undefined): "trialing" | "active" | "past_due" | "canceled" | "expired" {
  const normalized = text(status).toLowerCase();
  if (normalized === "trialing") return "trialing";
  if (normalized === "active") return "active";
  if (normalized === "past_due" || normalized === "unpaid" || normalized === "incomplete" || normalized === "incomplete_expired") {
    return "past_due";
  }
  if (normalized === "canceled") return "canceled";
  return "expired";
}

function addGraceDays(baseIso: string | null, days: number) {
  const base = baseIso ? new Date(baseIso) : new Date();
  const next = new Date(base.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString();
}

function computeGraceEndsAt(
  status: "trialing" | "active" | "past_due" | "canceled" | "expired",
  periodEndIso: string | null,
  graceDays: number
) {
  if (status === "past_due") return addGraceDays(null, graceDays);
  if (status === "canceled") return addGraceDays(periodEndIso, graceDays);
  return null;
}

function getGraceDays() {
  const raw = Number.parseInt(String(process.env.RUNBOOK_BILLING_GRACE_DAYS ?? "7"), 10);
  if (!Number.isFinite(raw) || raw < 0 || raw > 90) return 7;
  return raw;
}

function getPriceInfo(subscription: any) {
  const price = subscription?.items?.data?.[0]?.price;
  const recurring = price?.recurring;
  const unitAmount = Number(price?.unit_amount ?? Number.NaN);

  let billingInterval: "month" | "quarter" | "year" | "custom" | null = null;
  if (recurring?.interval === "month" && Number(recurring?.interval_count ?? 1) === 1) billingInterval = "month";
  else if (recurring?.interval === "month" && Number(recurring?.interval_count ?? 1) === 3) billingInterval = "quarter";
  else if (recurring?.interval === "year" && Number(recurring?.interval_count ?? 1) === 1) billingInterval = "year";
  else if (recurring?.interval) billingInterval = "custom";

  return {
    subscriptionPlan: price?.id ? String(price.id) : null,
    billingAmount: Number.isFinite(unitAmount) ? Number((unitAmount / 100).toFixed(2)) : null,
    billingInterval,
  };
}

async function loadShop(admin: ReturnType<typeof supabaseAdmin>, shopId: string) {
  const { data, error } = await admin
    .from("rb_shops")
    .select(SHOP_BILLING_SELECT_COLUMNS.join(","))
    .eq("id", shopId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const row = data as any;
  if (!row?.id) throw new Error("Shop not found");
  return row;
}

export async function POST(req: Request) {
  let actorUserId: string | null = null;
  let actorEmail: string | null = null;
  let shopId = "";
  let requestedAction = "";

  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    rateLimitOrThrow({ key: `billing:stripe-admin:${ip}`, limit: 60, windowMs: 60_000 });

    const { user } = await requirePlatformAdminAal2();
    actorUserId = user.id;
    actorEmail = user.email ?? null;

    const body = await req.json().catch(() => ({}));
    shopId = text((body as any).shop_id);
    requestedAction = text((body as any).action);

    if (!shopId) {
      return NextResponse.json({ ok: false, error: "Missing shop_id" }, { status: 400 });
    }

    assertUuid("shop_id", shopId);

    if (requestedAction !== "sync") {
      return NextResponse.json({ ok: false, error: "Unsupported Stripe billing action." }, { status: 400 });
    }

    const admin = supabaseAdmin();
    const currentShop = await loadShop(admin, shopId);
    const subscriptionId = text(currentShop.stripe_subscription_id);

    if (!subscriptionId) {
      return NextResponse.json({ ok: false, error: "This shop does not have a Stripe subscription to sync." }, { status: 400 });
    }

    const stripe = getStripe();
    const subscription: any = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["latest_invoice.lines", "items.data.price"],
    });

    const billingStatus = normalizeStripeStatus(subscription.status);
    const billingCurrentPeriodEnd =
      isoFromSeconds(subscription.current_period_end ?? null) ??
      isoFromSeconds(subscription?.latest_invoice?.lines?.data?.[0]?.period?.end ?? null);
    const { subscriptionPlan, billingAmount, billingInterval } = getPriceInfo(subscription);

    const patch = {
      stripe_customer_id: subscription.customer ? String(subscription.customer) : currentShop.stripe_customer_id ?? null,
      stripe_subscription_id: subscription.id ? String(subscription.id) : currentShop.stripe_subscription_id ?? null,
      billing_status: billingStatus,
      billing_current_period_end: billingCurrentPeriodEnd,
      subscription_plan: subscriptionPlan,
      billing_amount: billingAmount,
      billing_interval: billingInterval,
      grace_ends_at: computeGraceEndsAt(billingStatus, billingCurrentPeriodEnd, getGraceDays()),
    };

    const { data: updatedShop, error: updateError } = await admin
      .from("rb_shops")
      .update(patch)
      .eq("id", shopId)
      .select(SHOP_BILLING_SELECT_COLUMNS.join(","))
      .single();

    if (updateError) throw new Error(updateError.message);

    await writeAudit({
      actor_user_id: actorUserId,
      actor_email: actorEmail,
      action: "billing.stripe.synced",
      target_type: "shop",
      target_id: shopId,
      shop_id: shopId,
      meta: {
        stripe_customer_id: patch.stripe_customer_id ?? null,
        stripe_subscription_id: patch.stripe_subscription_id ?? null,
        billing_status: billingStatus,
        billing_current_period_end: billingCurrentPeriodEnd,
        subscription_plan: subscriptionPlan,
        billing_amount: billingAmount,
        billing_interval: billingInterval,
      },
    });

    const entitlement = await getShopEntitlement(shopId);
    return NextResponse.json({
      ok: true,
      changed: true,
      shop: updatedShop,
      entitlement,
      access: describeShopAccess(entitlement),
    });
  } catch (e: any) {
    const msg = e?.message ?? String(e);

    if (actorUserId && shopId) {
      try {
        await writeAudit({
          actor_user_id: actorUserId,
          actor_email: actorEmail,
          action: "billing.stripe.sync_failed",
          target_type: "shop",
          target_id: shopId,
          shop_id: shopId,
          meta: {
            requested_action: requestedAction || null,
            error: msg,
          },
        });
      } catch {
      }
    }

    const status =
      /not authenticated/i.test(msg) ? 401
      : /mfa required/i.test(msg) ? 403
      : /not a platform admin/i.test(msg) ? 403
      : /must be a uuid/i.test(msg) ? 400
      : /shop not found/i.test(msg) ? 404
      : 500;

    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
