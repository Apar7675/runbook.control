import { describeShopAccess } from "@/lib/billing/access";
import { getShopEntitlementFromRow, type ShopBillingRow } from "@/lib/billing/entitlement";
import { SHOP_BILLING_SELECT_COLUMNS, tryExtractMissingColumn } from "@/lib/billing/manual";
import { getViewerContext, type ViewerContext } from "@/lib/control/summary";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type BillingDirectoryViewRow = ShopBillingRow & {
  name: string;
  created_at: string | null;
  effective_billing_status: string;
  access_display_status: string;
  access_summary: string;
  desktop_access: string;
  mobile_access: string;
  workstation_access: string;
  trial_state_label: string;
};

export type BillingViewsData = {
  context: ViewerContext;
  rows: BillingDirectoryViewRow[];
  summary: {
    totalShops: number;
    fullAccess: number;
    trialing: number;
    trialEndingSoon: number;
    paymentRequired: number;
    blockedOrSuspended: number;
  };
};

type BillingDbRow = {
  id: string | null;
  name: string | null;
  created_at: string | null;
  updated_at: string | null;
  billing_status: string | null;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  trial_override_reason: string | null;
  billing_current_period_end: string | null;
  billing_amount: string | number | null;
  billing_interval: string | null;
  next_billing_date: string | null;
  manual_billing_status: string | null;
  grace_ends_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_plan: string | null;
  entitlement_override: string | null;
  manual_billing_override: boolean | null;
  billing_notes: string | null;
  deletion_status: string | null;
  deletion_started_at: string | null;
};

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asText(value: unknown) {
  return String(value ?? "").trim();
}

function isoOrNull(value: unknown) {
  const text = asText(value);
  return text || null;
}

function daysUntil(value: string | null | undefined) {
  if (!value) return null;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return null;
  return Math.ceil((ms - Date.now()) / (24 * 60 * 60 * 1000));
}

function humanize(value: string | null | undefined, fallback: string) {
  const text = asText(value);
  return text ? text.replaceAll("_", " ") : fallback;
}

function buildTrialStateLabel(row: ShopBillingRow, effectiveStatus: string) {
  if (row.deletion_started_at || asText(row.deletion_status).toLowerCase() === "deleting") return "restricted";
  if (effectiveStatus === "trialing") {
    const remaining = daysUntil(row.trial_ends_at);
    if (remaining !== null && remaining >= 0 && remaining <= 7) return `trial ending in ${remaining}d`;
    return "trial";
  }
  if (row.grace_ends_at) {
    const remaining = daysUntil(row.grace_ends_at);
    if (remaining !== null && remaining >= 0) return `grace ${remaining}d`;
  }
  if (effectiveStatus === "past_due" || effectiveStatus === "payment_required") return "payment required";
  if (effectiveStatus === "expired" || effectiveStatus === "suspended" || effectiveStatus === "trial_ended") return "restricted";
  return "normal";
}

async function loadBillingRows() {
  const admin = supabaseAdmin();
  const columns = ["created_at", "updated_at", "name", ...SHOP_BILLING_SELECT_COLUMNS];
  let working = [...columns];

  for (let attempt = 0; attempt < columns.length; attempt += 1) {
    const { data, error } = await admin
      .from("rb_shops")
      .select(working.join(","))
      .order("name", { ascending: true })
      .limit(1000);

    if (!error) return asArray<BillingDbRow>(data);

    const missing = tryExtractMissingColumn(String(error.message ?? ""));
    if (missing && working.includes(missing)) {
      working = working.filter((column) => column !== missing);
      continue;
    }

    throw new Error(error.message);
  }

  throw new Error("Unable to load billing rows.");
}

export async function loadBillingViews(): Promise<BillingViewsData> {
  const context = await getViewerContext();
  const rawRows = await loadBillingRows();

  const rows = rawRows.map((row) => {
    const shopRow: ShopBillingRow = {
      id: asText(row.id),
      billing_status: row.billing_status ?? null,
      trial_started_at: row.trial_started_at ?? null,
      trial_ends_at: row.trial_ends_at ?? null,
      trial_override_reason: row.trial_override_reason ?? null,
      billing_current_period_end: row.billing_current_period_end ?? null,
      billing_amount: row.billing_amount ?? null,
      billing_interval: row.billing_interval ?? null,
      next_billing_date: row.next_billing_date ?? null,
      manual_billing_status: row.manual_billing_status ?? null,
      grace_ends_at: row.grace_ends_at ?? null,
      stripe_customer_id: row.stripe_customer_id ?? null,
      stripe_subscription_id: row.stripe_subscription_id ?? null,
      subscription_plan: row.subscription_plan ?? null,
      entitlement_override: row.entitlement_override ?? null,
      manual_billing_override: row.manual_billing_override ?? null,
      billing_notes: row.billing_notes ?? null,
      deletion_status: row.deletion_status ?? null,
      deletion_started_at: row.deletion_started_at ?? null,
    };

    const entitlement = getShopEntitlementFromRow(shopRow);
    const access = describeShopAccess(entitlement);
    const effectiveStatus = entitlement.status;

    return {
      ...shopRow,
      name: asText(row.name) || "Unnamed shop",
      created_at: isoOrNull(row.created_at),
      effective_billing_status: effectiveStatus,
      access_display_status: access.display_status,
      access_summary: access.summary,
      desktop_access: access.desktop_mode,
      mobile_access: access.mobile_mode,
      workstation_access: access.workstation_mode,
      trial_state_label: buildTrialStateLabel(shopRow, effectiveStatus),
    } satisfies BillingDirectoryViewRow;
  });

  const summary = {
    totalShops: rows.length,
    fullAccess: rows.filter((row) => row.desktop_access === "full" && row.mobile_access === "full" && row.workstation_access === "full").length,
    trialing: rows.filter((row) => row.effective_billing_status === "trialing").length,
    trialEndingSoon: rows.filter((row) => {
      const remaining = daysUntil(row.trial_ends_at);
      return row.effective_billing_status === "trialing" && remaining !== null && remaining >= 0 && remaining <= 7;
    }).length,
    paymentRequired: rows.filter((row) => row.effective_billing_status === "past_due" || row.effective_billing_status === "payment_required").length,
    blockedOrSuspended: rows.filter((row) => row.desktop_access === "blocked" || row.workstation_access === "blocked" || row.effective_billing_status === "suspended" || row.effective_billing_status === "expired" || row.effective_billing_status === "trial_ended").length,
  };

  return {
    context,
    rows,
    summary,
  };
}

export function humanizeBillingValue(value: string | null | undefined, fallback: string) {
  return humanize(value, fallback);
}
