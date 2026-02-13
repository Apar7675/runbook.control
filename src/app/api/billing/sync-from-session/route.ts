// REPLACE ENTIRE FILE: src/app/api/billing/sync-from-session/route.ts
//
// REFACTOR (this pass):
// - Uses centralized authz.ts (AAL2 + shop access/admin).
// - Keeps rate limit, Stripe sync logic, and metadata stamping.
// - UUID tripwire handled by authz.assertUuid.
//
// NOTE: This is a billing sync route; it should NOT be blocked by billing gate.
// It *must* be protected by shop access / admin only.

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

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    rateLimitOrThrow({ key: `billing:sync:${ip}`, limit: 60, windowMs: 60_000 });

    // Require user + AAL2 (gives us user identity; shop access checked after we learn shopId from session)
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

    // Protect: caller must be a member of this shop or platform admin (AAL2 required).
    await requireShopAccessOrAdminAal2(shopId);

    const subId = session.subscription ? String(session.subscription) : null;

    let billing_status: string | null = "active";
    let nextPeriodEnd: string | undefined;

    if (subId) {
      const sub: any = await stripe.subscriptions.retrieve(subId, { expand: ["latest_invoice.lines"] });
      billing_status = sub.status ?? billing_status;

      const line = sub?.latest_invoice?.lines?.data?.[0];
      const periodEndSec = line?.period?.end;
      nextPeriodEnd = isoFromSeconds(periodEndSec);

      // Ensure future subscription events can map back to shop.
      await stripe.subscriptions.update(sub.id, { metadata: { shop_id: shopId, app: "runbook.control" } });
    }

    const patch: any = {
      stripe_customer_id: session.customer ?? null,
      stripe_subscription_id: subId,
      billing_status,
    };
    if (nextPeriodEnd) patch.billing_current_period_end = nextPeriodEnd;

    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("rb_shops")
      .update(patch)
      .eq("id", shopId)
      .select("id,name,billing_status,stripe_customer_id,stripe_subscription_id,billing_current_period_end")
      .single();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

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
