// REPLACE ENTIRE FILE: src/app/api/billing/backfill-period-end/route.ts
//
// HARDENING (this pass):
// - Requires platform admin + AAL2 (was wide-open server-role mutation).
// - Rate limit.
// - Adds dynamic export.
// - Makes update calls error-checked.
// - Keeps your "period end from latest_invoice.lines[0].period.end" logic.
//
// NOTE: This endpoint is powerful (mass update). Keep admin-only.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/server";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";
import { requirePlatformAdminAal2 } from "@/lib/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    rateLimitOrThrow({ key: `billing:backfill:${ip}`, limit: 30, windowMs: 60_000 });

    await requirePlatformAdminAal2();

    const admin = supabaseAdmin();
    const stripe = getStripe();

    const { data: shops, error } = await admin
      .from("rb_shops")
      .select("id, name, stripe_subscription_id")
      .is("billing_current_period_end", null)
      .not("stripe_subscription_id", "is", null);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    let updated = 0;
    const details: any[] = [];

    for (const shop of shops ?? []) {
      try {
        const sub: any = await stripe.subscriptions.retrieve(String(shop.stripe_subscription_id), {
          expand: ["latest_invoice.lines"],
        });

        const line = sub?.latest_invoice?.lines?.data?.[0];
        const periodEnd = line?.period?.end;

        details.push({
          name: shop.name,
          subId: shop.stripe_subscription_id,
          period_end_raw: periodEnd ?? null,
        });

        if (!periodEnd) continue;

        const iso = new Date(Number(periodEnd) * 1000).toISOString();

        const { error: upErr } = await admin
          .from("rb_shops")
          .update({ billing_current_period_end: iso })
          .eq("id", shop.id);

        if (upErr) {
          details.push({ name: shop.name, subId: shop.stripe_subscription_id, update_error: upErr.message });
          continue;
        }

        updated++;
      } catch (e: any) {
        details.push({
          name: shop.name,
          subId: shop.stripe_subscription_id,
          error: e?.message ?? String(e),
        });
      }
    }

    return NextResponse.json({ ok: true, updated, details });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    const status =
      /not authenticated/i.test(msg) ? 401 : /mfa required/i.test(msg) ? 403 : /not a platform admin/i.test(msg) ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
