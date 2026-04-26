import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";
import { assertUuid, requireShopAccessOrAdminAal2 } from "@/lib/authz";
import { getShopEntitlementFromRow, type ShopBillingRow } from "@/lib/billing/entitlement";
import { describeShopAccess } from "@/lib/billing/access";
import { SHOP_BILLING_SELECT_COLUMNS, tryExtractMissingColumn } from "@/lib/billing/manual";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function loadShopWithAutoStrip(admin: any, shopId: string) {
  const columns: string[] = [...SHOP_BILLING_SELECT_COLUMNS];

  let working = [...columns];

  for (let attempt = 0; attempt < columns.length; attempt++) {
    const { data, error } = await admin
      .from("rb_shops")
      .select(working.join(","))
      .eq("id", shopId)
      .maybeSingle();

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

function normalizeShopRow(shop: any): ShopBillingRow {
  return {
    id: shop.id,
    billing_status: shop.billing_status ?? null,
    trial_started_at: shop.trial_started_at ?? null,
    trial_ends_at: shop.trial_ends_at ?? null,
    trial_override_reason: shop.trial_override_reason ?? null,
    billing_current_period_end: shop.billing_current_period_end ?? null,
    billing_amount: shop.billing_amount ?? null,
    billing_interval: shop.billing_interval ?? null,
    next_billing_date: shop.next_billing_date ?? null,
    manual_billing_status: shop.manual_billing_status ?? null,
    grace_ends_at: shop.grace_ends_at ?? null,
    stripe_customer_id: shop.stripe_customer_id ?? null,
    stripe_subscription_id: shop.stripe_subscription_id ?? null,
    subscription_plan: shop.subscription_plan ?? null,
    entitlement_override: shop.entitlement_override ?? null,
    manual_billing_override: shop.manual_billing_override ?? null,
    billing_notes: shop.billing_notes ?? null,
    deletion_status: shop.deletion_status ?? null,
    deletion_started_at: shop.deletion_started_at ?? null,
  };
}

export async function GET(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    rateLimitOrThrow({ key: `billing:status:${ip}`, limit: 120, windowMs: 60_000 });

    const url = new URL(req.url);
    const shopId = (url.searchParams.get("shop_id") ?? "").trim();
    if (!shopId) return NextResponse.json({ ok: false, error: "Missing shop_id" }, { status: 400 });
    assertUuid("shop_id", shopId);

    const ctx = await requireShopAccessOrAdminAal2(shopId);

    const admin = supabaseAdmin();
    const shop = await loadShopWithAutoStrip(admin, shopId);

    if (!shop) return NextResponse.json({ ok: false, error: "Shop not found" }, { status: 404 });

    const entitlement = getShopEntitlementFromRow(normalizeShopRow(shop));
    const access = describeShopAccess(entitlement);
    return NextResponse.json({ ok: true, shop, entitlement, access, admin: { is_platform_admin: ctx.isAdmin } });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    const status =
      /not authenticated/i.test(msg) ? 401
      : /mfa required/i.test(msg) ? 403
      : /access denied/i.test(msg) ? 403
      : /not a platform admin/i.test(msg) ? 403
      : /must be a uuid/i.test(msg) ? 400
      : 500;

    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
