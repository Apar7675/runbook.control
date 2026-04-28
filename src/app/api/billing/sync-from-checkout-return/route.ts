import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";
import { getStripe } from "@/lib/stripe/server";
import { assertUuid } from "@/lib/authz";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function s(v: any) {
  return String(v ?? "").trim();
}

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
  const subStatus = s(status).toLowerCase();
  if (subStatus === "trialing") return "trialing";
  if (subStatus === "active") return "active";
  if (subStatus === "past_due" || subStatus === "unpaid" || subStatus === "incomplete" || subStatus === "incomplete_expired") return "past_due";
  if (subStatus === "canceled") return "canceled";
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
    if (!error) return;

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
    rateLimitOrThrow({ key: `billing:syncreturn:${ip}`, limit: 120, windowMs: 60_000 });

    const body = await req.json().catch(() => ({}));
    const shop_id = s((body as any)?.shop_id);
    const session_id = s((body as any)?.session_id);

    if (!shop_id) return NextResponse.json({ ok: false, error: "Missing shop_id" }, { status: 400 });
    if (!session_id) return NextResponse.json({ ok: false, error: "Missing session_id" }, { status: 400 });

    assertUuid("shop_id", shop_id);
    const graceDays = getGraceDays();

    const stripe = getStripe();
    const session: any = await stripe.checkout.sessions.retrieve(session_id, { expand: ["subscription", "subscription.items.data.price"] });

    const sessionShopId = s(session.client_reference_id) || s(session.metadata?.shop_id);

    if (!sessionShopId) {
      return NextResponse.json(
        { ok: false, error: "No shop id on session (client_reference_id + metadata.shop_id empty)" },
        { status: 400 }
      );
    }

    if (sessionShopId !== shop_id) {
      return NextResponse.json({ ok: false, error: "shop_id does not match Stripe session" }, { status: 400 });
    }

    const sub: any = session.subscription ?? null;
    const subId = s(sub?.id) || (session.subscription ? s(session.subscription) : null);
    const billing_status = normalizeStripeStatus(sub?.status || session?.status || "expired");
    const periodEndSec = Number(sub?.current_period_end ?? 0);
    const nextPeriodEnd = periodEndSec > 0 ? isoFromSeconds(periodEndSec) : undefined;
    const subscriptionPlan = getSubscriptionPlan(sub);

    if (sub?.id) {
      await stripe.subscriptions.update(sub.id, { metadata: { shop_id: shop_id, app: "runbook.control" } });
    }

    const patch: any = {
      stripe_customer_id: session.customer ?? null,
      stripe_subscription_id: subId,
      billing_status,
      subscription_plan: subscriptionPlan,
      grace_ends_at: computeGraceEndsAt(billing_status, graceDays, nextPeriodEnd),
      updated_at: new Date().toISOString(),
    };
    if (nextPeriodEnd) patch.billing_current_period_end = nextPeriodEnd;

    const admin = supabaseAdmin();
    await updateShopWithAutoStrip(admin, shop_id, patch);
    const data = await loadShopWithAutoStrip(admin, shop_id);

    return NextResponse.json({ ok: true, shop: data ?? { id: shop_id, billing_status } });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
