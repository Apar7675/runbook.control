import { NextResponse } from "next/server";
import { requirePlatformAdminAal2 } from "@/lib/authz";
import { describeShopAccess } from "@/lib/billing/access";
import { getShopEntitlementFromRow, type ShopBillingRow } from "@/lib/billing/entitlement";
import { SHOP_BILLING_SELECT_COLUMNS, tryExtractMissingColumn } from "@/lib/billing/manual";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const DIRECTORY_LIMIT = 1000;

type BillingDirectoryRow = {
  id: string;
  name: string;
  subscription_plan: string | null;
  billing_status: string | null;
  manual_billing_status: string | null;
  manual_billing_override: boolean | null;
  entitlement_override: string | null;
  trial_ends_at: string | null;
  grace_ends_at: string | null;
  stripe_subscription_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  trial_started_at: string | null;
  trial_override_reason: string | null;
  billing_current_period_end: string | null;
  billing_amount: string | number | null;
  billing_interval: string | null;
  next_billing_date: string | null;
  stripe_customer_id: string | null;
  billing_notes: string | null;
  deletion_status: string | null;
  deletion_started_at: string | null;
};

function normalizeRow(row: any): BillingDirectoryRow {
  return {
    id: row.id,
    name: row.name ?? "Unnamed shop",
    subscription_plan: row.subscription_plan ?? null,
    billing_status: row.billing_status ?? null,
    manual_billing_status: row.manual_billing_status ?? null,
    manual_billing_override: row.manual_billing_override ?? null,
    entitlement_override: row.entitlement_override ?? null,
    trial_ends_at: row.trial_ends_at ?? null,
    grace_ends_at: row.grace_ends_at ?? null,
    stripe_subscription_id: row.stripe_subscription_id ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
    trial_started_at: row.trial_started_at ?? null,
    trial_override_reason: row.trial_override_reason ?? null,
    billing_current_period_end: row.billing_current_period_end ?? null,
    billing_amount: row.billing_amount ?? null,
    billing_interval: row.billing_interval ?? null,
    next_billing_date: row.next_billing_date ?? null,
    stripe_customer_id: row.stripe_customer_id ?? null,
    billing_notes: row.billing_notes ?? null,
    deletion_status: row.deletion_status ?? null,
    deletion_started_at: row.deletion_started_at ?? null,
  };
}

function toEntitlementRow(row: BillingDirectoryRow): ShopBillingRow {
  return {
    id: row.id,
    billing_status: row.billing_status,
    trial_started_at: row.trial_started_at,
    trial_ends_at: row.trial_ends_at,
    trial_override_reason: row.trial_override_reason,
    billing_current_period_end: row.billing_current_period_end,
    billing_amount: row.billing_amount,
    billing_interval: row.billing_interval,
    next_billing_date: row.next_billing_date,
    manual_billing_status: row.manual_billing_status,
    grace_ends_at: row.grace_ends_at,
    stripe_customer_id: row.stripe_customer_id,
    stripe_subscription_id: row.stripe_subscription_id,
    subscription_plan: row.subscription_plan,
    entitlement_override: row.entitlement_override,
    manual_billing_override: row.manual_billing_override,
    billing_notes: row.billing_notes,
    deletion_status: row.deletion_status,
    deletion_started_at: row.deletion_started_at,
  };
}

export async function GET(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    rateLimitOrThrow({ key: `billing:directory:${ip}`, limit: 120, windowMs: 60_000 });
    await requirePlatformAdminAal2();

    const admin = supabaseAdmin();
    const columns = ["created_at", "updated_at", ...SHOP_BILLING_SELECT_COLUMNS];
    let working = [...columns];
    let rows: any[] | null = null;

    for (let attempt = 0; attempt < columns.length; attempt++) {
      const result = await admin.from("rb_shops").select(working.join(",")).order("name", { ascending: true }).limit(DIRECTORY_LIMIT);
      if (!result.error) {
        rows = (result.data ?? []) as any[];
        break;
      }

      const missing = tryExtractMissingColumn(String(result.error.message ?? result.error ?? ""));
      if (missing && working.includes(missing)) {
        working = working.filter((column) => column !== missing);
        continue;
      }

      return NextResponse.json({ ok: false, error: result.error.message }, { status: 500 });
    }

    const normalized = (rows ?? []).map(normalizeRow);
    const now = Date.now();
    const directory = normalized.map((row) => {
      const entitlement = getShopEntitlementFromRow(toEntitlementRow(row), now);
      const access = describeShopAccess(entitlement);
      return {
        ...row,
        effective_billing_status: entitlement.status,
        access_display_status: access.display_status,
        access_summary: access.summary,
        entitlement_allowed: entitlement.allowed,
        entitlement_restricted: entitlement.restricted,
        grace_active: entitlement.grace_active,
      };
    });

    return NextResponse.json({
      ok: true,
      rows: directory,
      meta: {
        row_limit: DIRECTORY_LIMIT,
        pagination: "not_yet_supported",
        note: "Directory truth remains server-authoritative. The current route is capped at 1000 shops pending a later pagination/cursoring pass.",
      },
    });
  } catch (e: any) {
    const msg = e?.message ?? "Server error";
    const status =
      /not authenticated/i.test(msg) ? 401 :
      /mfa required/i.test(msg) ? 403 :
      /not a platform admin/i.test(msg) ? 403 :
      500;

    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
