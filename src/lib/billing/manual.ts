export type SystemBillingStatus = "trialing" | "active" | "past_due" | "canceled" | "expired";
export type ManualBillingStatus =
  | "trial_active"
  | "trial_extended"
  | "trial_ended"
  | "payment_required"
  | "paid_active"
  | "suspended";
export type RuntimeBillingStatus = SystemBillingStatus | ManualBillingStatus;
export type BillingInterval = "month" | "quarter" | "year" | "custom";

export const SHOP_BILLING_SELECT_COLUMNS = [
  "id",
  "name",
  "billing_status",
  "trial_started_at",
  "trial_ends_at",
  "trial_override_reason",
  "billing_current_period_end",
  "billing_amount",
  "billing_interval",
  "next_billing_date",
  "manual_billing_status",
  "grace_ends_at",
  "stripe_customer_id",
  "stripe_subscription_id",
  "subscription_plan",
  "entitlement_override",
  "manual_billing_override",
  "billing_notes",
  "deletion_status",
  "deletion_started_at",
] as const;

export function tryExtractMissingColumn(msg: string): string | null {
  const text = String(msg ?? "");
  const relationMatch = text.match(/column\s+"([^"]+)"\s+of\s+relation/i);
  if (relationMatch?.[1]) return relationMatch[1];

  const schemaCacheMatch = text.match(/Could not find the '([^']+)' column/i);
  if (schemaCacheMatch?.[1]) return schemaCacheMatch[1];

  const qualifiedMatch = text.match(/column\s+rb_shops\.([a-zA-Z0-9_]+)\s+does\s+not\s+exist/i);
  if (qualifiedMatch?.[1]) return qualifiedMatch[1];

  return null;
}

export function normalizeSystemBillingStatus(value: string | null | undefined): SystemBillingStatus {
  const status = String(value ?? "").trim().toLowerCase();
  if (status === "trialing" || status === "active" || status === "past_due" || status === "canceled" || status === "expired") {
    return status;
  }
  return "expired";
}

export function normalizeRuntimeBillingStatus(value: string | null | undefined): RuntimeBillingStatus {
  const status = String(value ?? "").trim().toLowerCase();
  if (
    status === "trialing" ||
    status === "active" ||
    status === "past_due" ||
    status === "canceled" ||
    status === "expired" ||
    status === "trial_active" ||
    status === "trial_extended" ||
    status === "trial_ended" ||
    status === "payment_required" ||
    status === "paid_active" ||
    status === "suspended"
  ) {
    return status;
  }
  return "expired";
}

export function normalizeBillingInterval(value: string | null | undefined): BillingInterval {
  const interval = String(value ?? "").trim().toLowerCase();
  if (interval === "month" || interval === "quarter" || interval === "year" || interval === "custom") return interval;
  return "month";
}

export function parseIsoMillis(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

export function isFutureIso(value: string | null | undefined, now = Date.now()): boolean {
  const ms = parseIsoMillis(value);
  return ms !== null && ms > now;
}

export function toIsoOrNull(value: unknown): string | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const ms = Date.parse(text);
  if (!Number.isFinite(ms)) throw new Error(`Invalid date: ${text}`);
  return new Date(ms).toISOString();
}
