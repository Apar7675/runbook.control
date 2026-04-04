import { supabaseAdmin } from "@/lib/supabase/admin";

export type BillingStatus = "trialing" | "active" | "past_due" | "canceled" | "expired";

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
  billing_current_period_end: string | null;
  grace_ends_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_plan: string | null;
  entitlement_override: string | null;
};

function normalizeStatus(value: string | null | undefined): BillingStatus {
  const status = String(value ?? "").trim().toLowerCase();
  if (status === "trialing" || status === "active" || status === "past_due" || status === "canceled" || status === "expired") {
    return status;
  }
  return "expired";
}

function parseMillis(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function normalizeOverride(value: string | null | undefined): EntitlementOverride {
  const override = String(value ?? "").trim().toLowerCase();
  if (override === "allow" || override === "restricted") return override;
  return null;
}

function isFuture(value: string | null | undefined, now = Date.now()): boolean {
  const ms = parseMillis(value);
  return ms !== null && ms > now;
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

async function loadShop(shopId: string): Promise<ShopBillingRow> {
  const admin = supabaseAdmin();
  const columns = [
    "id",
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
      .maybeSingle();

    if (!error) {
      const row: any = data;
      if (!row?.id) throw new Error("Shop not found");
      return {
        id: row.id,
        billing_status: row.billing_status ?? null,
        trial_started_at: row.trial_started_at ?? null,
        trial_ends_at: row.trial_ends_at ?? null,
        billing_current_period_end: row.billing_current_period_end ?? null,
        grace_ends_at: row.grace_ends_at ?? null,
        stripe_customer_id: row.stripe_customer_id ?? null,
        stripe_subscription_id: row.stripe_subscription_id ?? null,
        subscription_plan: row.subscription_plan ?? null,
        entitlement_override: row.entitlement_override ?? null,
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
  let status = normalizeStatus(shop.billing_status);
  const override = normalizeOverride(shop.entitlement_override);

  if (status === "trialing" && shop.trial_ends_at && now > (parseMillis(shop.trial_ends_at) ?? Number.MAX_SAFE_INTEGER)) {
    status = "expired";
  }

  const graceActive =
    (status === "past_due" || status === "canceled") &&
    isFuture(shop.grace_ends_at, now);

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
