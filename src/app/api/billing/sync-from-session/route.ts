import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";
import { getStripe } from "@/lib/stripe/server";
import { assertUuid, requireAal2, requireShopAccessOrAdminAal2 } from "@/lib/authz";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isoFromSeconds(sec?: number | null): string | undefined {
  if (!sec) return undefined;
  return new Date(Number(sec) * 1000).toISOString();
}

function tryExtractMissingColumn(msg: string): string | null {
  const text = String(msg ?? "");
  const relationMatch = text.match(/column\s+"([^"]+)"\s+of\s+relation/i);
  if (relationMatch?.[1]) return relationMatch[1];

  const schemaCacheMatch = text.match(/Could not find the '([^']+)' column/i);
  if (schemaCacheMatch?.[1]) return schemaCacheMatch[1];

  const qualifiedMatch = text.match(/column\s+rb_shops\.([a-zA-Z0-9_]+)\s+does\s+not\s+exist/i);
  if (qualifiedMatch?.[1]) return qualifiedMatch[1];

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

function getSubscriptionPlan(sub: any): string | null {
  const priceId = sub?.items?.data?.[0]?.price?.id;
  return priceId ? String(priceId) : null;
}

async function updateShopWithAutoStrip(admin: any, shopId: string, patch: Record<string, any>) {
  const working: Record<string, any> = { ...patch };

  for (let attempt = 0; attempt < 12; attempt++) {
    const { error } = await admin.from("rb_shops").update(working).eq("id", shopId);
    if (!error) return null;

    const msg = String(error.message ?? error ?? "");
    const col = tryExtractMissingColumn(msg);
    if (col && Object.prototype.hasOwnProperty.call(working, col)) {
      delete working[col];
      continue;
    }

    throw new Error(msg);
  }

  throw new Error("Update failed after stripping missing columns");
}

async function loadShopWithAutoStrip(admin: any, shopId: string) {
  const columns = [
    "id",
    "name",
    "billing_status",
    "trial_started_at",
    "trial_ends_at",
    "billing_current_period_end",
    "grace_ends_at",
    "stripe_customer_id",
    "stripe_subscription_id",
    "subscription_plan",
    "entitlement_override",
  ];

  let working = [...columns];

  for (let attempt = 0; attempt < columns.length; attempt++) {
    const { data, error } = await admin
      .from("rb_shops")
      .select(working.join(","))
      .eq("id", shopId)
      .single();

    if (!error) return data;

    const msg = String(error.message ?? error ?? "");
    const col = tryExtractMissingColumn(msg);
    if (col && working.includes(col)) {
      working = working.filter((entry) => entry !== col);
      continue;
    }

    throw new Error(msg);
  }

  throw new Error("Select failed after stripping missing columns");
}

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    rateLimitOrThrow({ key: `billing:sync:${ip}`, limit: 60, windowMs: 60_000 });

    await requireAal2();

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

    assertUuid("shopId", shopId);
    await requireShopAccessOrAdminAal2(shopId);
    const graceDays = getGraceDays();

    const subId = session.subscription ? String(session.subscription) : null;
    let billing_status: "trialing" | "active" | "past_due" | "canceled" | "expired" = "expired";
    let nextPeriodEnd: string | undefined;
    let subscriptionPlan: string | null = null;

    if (subId) {
      const sub: any = await stripe.subscriptions.retrieve(subId, { expand: ["latest_invoice.lines", "items.data.price"] });
      billing_status = normalizeStripeStatus(sub.status);
      nextPeriodEnd = isoFromSeconds(sub?.current_period_end ?? null) ?? isoFromSeconds(sub?.latest_invoice?.lines?.data?.[0]?.period?.end ?? null);
      subscriptionPlan = getSubscriptionPlan(sub);

      await stripe.subscriptions.update(sub.id, { metadata: { shop_id: shopId, app: "runbook.control" } });
    }

    const patch: any = {
      stripe_customer_id: session.customer ?? null,
      stripe_subscription_id: subId,
      billing_status,
      subscription_plan: subscriptionPlan,
      grace_ends_at: computeGraceEndsAt(billing_status, graceDays, nextPeriodEnd),
    };
    if (nextPeriodEnd) patch.billing_current_period_end = nextPeriodEnd;

    const admin = supabaseAdmin();
    await updateShopWithAutoStrip(admin, shopId, patch);
    const data = await loadShopWithAutoStrip(admin, shopId);

    return NextResponse.json({ ok: true, shop: data });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    const status =
      /not authenticated/i.test(msg) ? 401
      : /mfa required/i.test(msg) ? 403
      : /access denied/i.test(msg) ? 403
      : /must be a uuid/i.test(msg) ? 400
      : 500;

    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
