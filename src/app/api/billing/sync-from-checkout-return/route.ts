// CREATE NEW FILE: src/app/api/billing/sync-from-checkout-return/route.ts
//
// Public-friendly Stripe return sync for Desktop checkout.
// - NO browser session required.
// - Verifies Stripe Checkout Session via Stripe secret.
// - Uses Supabase service role to update rb_shops billing fields.
// - Does NOT use requireAal2 / cookies.

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
  // Postgres style: column "foo" of relation "rb_shops" does not exist
  const m = String(msg ?? "").match(/column\s+"([^"]+)"\s+of\s+relation/i);
  return m?.[1] ?? null;
}

async function updateShopWithAutoStrip(admin: any, shopId: string, patch: Record<string, any>) {
  let working: Record<string, any> = { ...patch };

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

    const stripe = getStripe();

    // Expand subscription so we can read status/period end without extra calls
    const session: any = await stripe.checkout.sessions.retrieve(session_id, { expand: ["subscription"] });

    const sessionShopId =
      s(session.client_reference_id) ||
      s(session.metadata?.shop_id);

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

    // Stripe session + sub status
    const subStatus = s(sub?.status || session?.status || "unknown").toLowerCase();
    const billing_status =
      subStatus === "trialing" || subStatus === "active" ? subStatus : (subStatus || "active");

    // Period end
    const periodEndSec = Number(sub?.current_period_end ?? 0);
    const nextPeriodEnd = periodEndSec > 0 ? isoFromSeconds(periodEndSec) : undefined;

    // Make sure sub metadata is stamped for webhook mapping
    if (sub?.id) {
      await stripe.subscriptions.update(sub.id, { metadata: { shop_id: shop_id, app: "runbook.control" } });
    }

    const patch: any = {
      stripe_customer_id: session.customer ?? null,
      stripe_subscription_id: subId,
      billing_status,
      updated_at: new Date().toISOString(),
    };
    if (nextPeriodEnd) patch.billing_current_period_end = nextPeriodEnd;

    const admin = supabaseAdmin();
    await updateShopWithAutoStrip(admin, shop_id, patch);

    // Return updated shop snapshot (best-effort)
    const { data } = await admin
      .from("rb_shops")
      .select("id,name,billing_status,stripe_customer_id,stripe_subscription_id,billing_current_period_end")
      .eq("id", shop_id)
      .single();

    return NextResponse.json({ ok: true, shop: data ?? { id: shop_id, billing_status } });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
