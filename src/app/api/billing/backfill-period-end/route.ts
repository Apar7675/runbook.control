import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/server";

export const runtime = "nodejs";

export async function POST() {
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
      const sub: any = await stripe.subscriptions.retrieve(
        shop.stripe_subscription_id,
        { expand: ["latest_invoice.lines"] }
      );

      const line = sub?.latest_invoice?.lines?.data?.[0];
      const periodEnd = line?.period?.end;

      details.push({
        name: shop.name,
        subId: shop.stripe_subscription_id,
        period_end_raw: periodEnd ?? null,
      });

      if (!periodEnd) continue;

      await admin
        .from("rb_shops")
        .update({
          billing_current_period_end: new Date(periodEnd * 1000).toISOString(),
        })
        .eq("id", shop.id);

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
}
