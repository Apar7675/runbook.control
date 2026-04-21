import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  normalizeRuntimeBillingStatus,
  normalizeSystemBillingStatus,
  isFutureIso,
  parseIsoMillis,
  SHOP_BILLING_SELECT_COLUMNS,
  type RuntimeBillingStatus,
  tryExtractMissingColumn,
} from "@/lib/billing/manual";

export type BillingStatus = RuntimeBillingStatus;

export type ShopEntitlement = {
  status: BillingStatus;
  allowed: boolean;
  restricted: boolean;
  reason: string;
  grace_active: boolean;
};

type EntitlementOverride = "allow" | "restricted" | null;

type ShopBillingRow = {
  id: string;
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
};

function normalizeOverride(value: string | null | undefined): EntitlementOverride {
  const override = String(value ?? "").trim().toLowerCase();
  if (override === "allow" || override === "restricted") return override;
  return null;
}

async function loadShop(shopId: string): Promise<ShopBillingRow> {
  const admin = supabaseAdmin();
  const columns: string[] = [...SHOP_BILLING_SELECT_COLUMNS];

  let working = [...columns];

  for (let attempt = 0; attempt < columns.length; attempt++) {
    const { data, error } = await admin
      .from("rb_shops")
      .select(working.join(","))
      .eq("id", shopId)
      .maybeSingle();

    if (!error) {
      const row: any = data;
      if (!row?.id) throw new Error("Shop not found");
      return {
        id: row.id,
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
      };
    }

    const msg = String(error.message ?? error ?? "");
    const col = tryExtractMissingColumn(msg);
    if (col && working.includes(col)) {
      working = working.filter((entry) => entry !== col);
      continue;
    }

    throw new Error(msg);
  }

  throw new Error("Shop lookup failed after stripping missing columns");
}

export async function getShopEntitlement(shopId: string): Promise<ShopEntitlement> {
  const now = Date.now();
  const shop = await loadShop(shopId);
  let status = normalizeSystemBillingStatus(shop.billing_status);
  const override = normalizeOverride(shop.entitlement_override);

  if (shop.manual_billing_override) {
    const manualStatus = normalizeRuntimeBillingStatus(shop.manual_billing_status);
    const manualEntitlement = getManualEntitlement(manualStatus);
    return applyEntitlementOverride(manualEntitlement, override);
  }

  if (status === "trialing" && shop.trial_ends_at && now > (parseIsoMillis(shop.trial_ends_at) ?? Number.MAX_SAFE_INTEGER)) {
    status = "expired";
  }

  const graceActive =
    (status === "past_due" || status === "canceled") &&
    isFutureIso(shop.grace_ends_at, now);

  let entitlement: ShopEntitlement;

  if (status === "trialing") {
    entitlement = {
      status,
      allowed: true,
      restricted: false,
      reason: shop.trial_ends_at ? "trial_valid" : "trial_valid_no_end",
      grace_active: false,
    };
  } else if (status === "active") {
    entitlement = {
      status,
      allowed: true,
      restricted: false,
      reason: "subscription_active",
      grace_active: false,
    };
  } else if (status === "past_due") {
    entitlement = {
      status,
      allowed: false,
      restricted: true,
      reason: graceActive ? "payment_failed_in_grace" : "payment_failed",
      grace_active: graceActive,
    };
  } else if (status === "canceled") {
    entitlement = {
      status,
      allowed: false,
      restricted: true,
      reason: graceActive ? "canceled_in_grace" : "canceled",
      grace_active: graceActive,
    };
  } else {
    entitlement = {
      status: "expired",
      allowed: false,
      restricted: true,
      reason: "entitlement_expired",
      grace_active: false,
    };
  }

  return applyEntitlementOverride(entitlement, override);
}

function getManualEntitlement(status: RuntimeBillingStatus): ShopEntitlement {
  if (status === "trial_active" || status === "trial_extended") {
    return {
      status,
      allowed: true,
      restricted: false,
      reason: `manual_override:${status}`,
      grace_active: false,
    };
  }

  if (status === "paid_active") {
    return {
      status,
      allowed: true,
      restricted: false,
      reason: "manual_override:paid_active",
      grace_active: false,
    };
  }

  if (status === "trial_ended") {
    return {
      status,
      allowed: false,
      restricted: true,
      reason: "manual_override:trial_ended",
      grace_active: false,
    };
  }

  if (status === "payment_required") {
    return {
      status,
      allowed: false,
      restricted: true,
      reason: "manual_override:payment_required",
      grace_active: false,
    };
  }

  if (status === "suspended") {
    return {
      status,
      allowed: false,
      restricted: true,
      reason: "manual_override:suspended",
      grace_active: false,
    };
  }

  return {
    status,
    allowed: false,
    restricted: true,
    reason: `manual_override:${status}`,
    grace_active: false,
  };
}

function applyEntitlementOverride(entitlement: ShopEntitlement, override: EntitlementOverride): ShopEntitlement {
  if (override === "allow") {
    return {
      ...entitlement,
      allowed: true,
      restricted: false,
      reason: `override_allow:${entitlement.reason}`,
    };
  }

  if (override === "restricted") {
    return {
      ...entitlement,
      allowed: false,
      restricted: true,
      reason: `override_restricted:${entitlement.reason}`,
    };
  }

  return entitlement;
}
