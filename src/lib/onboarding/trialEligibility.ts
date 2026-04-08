import { supabaseAdmin } from "@/lib/supabase/admin";

const SHOP_TABLE = "rb_shops";
const MEMBER_TABLE = "rb_shop_members";
const HISTORY_TABLE = "rb_trial_usage_history";
const OPTIONAL_SHOP_COLUMNS = [
  "billing_status",
  "trial_started_at",
  "trial_ends_at",
  "trial_restricted",
  "trial_restriction_reason",
  "trial_consumed_at",
  "trial_eligibility_reason",
  "stripe_customer_id",
  "stripe_subscription_id",
] as const;

export type TrialOutcome = "clean_trial" | "restricted_trial" | "billing_required";
export type TrialEligibilitySignal =
  | "device_id"
  | "email_hash"
  | "phone_hash"
  | "auth_user_id"
  | "existing_membership"
  | "billing_customer"
  | "billing_subscription";

export type TrialEligibilityResult = {
  outcome: TrialOutcome;
  billingRequired: boolean;
  restrictedTrial: boolean;
  eligibilityReason: string;
  primarySignal: TrialEligibilitySignal | null;
  signals: TrialEligibilitySignal[];
  matchedShopId: string | null;
  matchedShopName: string | null;
};

type ShopRecord = {
  id: string;
  name: string;
  billing_status: string | null;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  trial_restricted: boolean;
  trial_restriction_reason: string | null;
  trial_consumed_at: string | null;
  trial_eligibility_reason: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
};

function s(value: unknown) {
  return String(value ?? "").trim();
}

function formatSbError(error: any) {
  if (!error) return "Unknown error";
  const msg = String(error.message ?? error ?? "");
  const code = error.code ? ` code=${String(error.code)}` : "";
  const details = error.details ? ` details=${String(error.details)}` : "";
  const hint = error.hint ? ` hint=${String(error.hint)}` : "";
  return `${msg}${code}${details}${hint}`;
}

function tryExtractMissingColumn(msg: string): string | null {
  const relationMatch = msg.match(/column\s+"([^"]+)"\s+of\s+relation/i);
  if (relationMatch?.[1]) return relationMatch[1];

  const schemaCacheMatch = msg.match(/could not find the\s+'([^']+)'\s+column/i);
  if (schemaCacheMatch?.[1]) return schemaCacheMatch[1];

  const qualifiedColumnMatch = msg.match(/column\s+([a-z0-9_]+\.){0,2}([a-z0-9_]+)\s+does not exist/i);
  if (qualifiedColumnMatch?.[2]) return qualifiedColumnMatch[2];

  return null;
}

function relationMissing(error: any) {
  const msg = formatSbError(error);
  return /relation\s+"[^"]+"\s+does not exist/i.test(msg) || /Could not find the table/i.test(msg);
}

function normalizeBillingStatus(value: unknown) {
  return s(value).toLowerCase();
}

function isPaidHistoryShop(shop: ShopRecord | null) {
  if (!shop) return false;
  const status = normalizeBillingStatus(shop.billing_status);
  return Boolean(shop.stripe_customer_id || shop.stripe_subscription_id) || ["active", "past_due", "unpaid", "canceled", "expired"].includes(status);
}

function toShopRecord(data: any): ShopRecord {
  return {
    id: s(data?.id),
    name: s(data?.name),
    billing_status: data?.billing_status ? String(data.billing_status) : null,
    trial_started_at: data?.trial_started_at ? String(data.trial_started_at) : null,
    trial_ends_at: data?.trial_ends_at ? String(data.trial_ends_at) : null,
    trial_restricted: Boolean(data?.trial_restricted),
    trial_restriction_reason: data?.trial_restriction_reason ? String(data.trial_restriction_reason) : null,
    trial_consumed_at: data?.trial_consumed_at ? String(data.trial_consumed_at) : null,
    trial_eligibility_reason: data?.trial_eligibility_reason ? String(data.trial_eligibility_reason) : null,
    stripe_customer_id: data?.stripe_customer_id ? String(data.stripe_customer_id) : null,
    stripe_subscription_id: data?.stripe_subscription_id ? String(data.stripe_subscription_id) : null,
  };
}

function baseCleanResult(): TrialEligibilityResult {
  return {
    outcome: "clean_trial",
    billingRequired: false,
    restrictedTrial: false,
    eligibilityReason: "clean_trial",
    primarySignal: null,
    signals: [],
    matchedShopId: null,
    matchedShopName: null,
  };
}

function buildResult(args: {
  outcome: TrialOutcome;
  reason: string;
  primarySignal: TrialEligibilitySignal;
  matchedShop?: ShopRecord | null;
  extraSignals?: TrialEligibilitySignal[];
}): TrialEligibilityResult {
  const uniqueSignals = [args.primarySignal, ...(args.extraSignals ?? [])].filter(
    (value, index, list) => value && list.indexOf(value) === index
  ) as TrialEligibilitySignal[];

  return {
    outcome: args.outcome,
    billingRequired: args.outcome === "billing_required",
    restrictedTrial: args.outcome !== "clean_trial",
    eligibilityReason: args.reason,
    primarySignal: args.primarySignal,
    signals: uniqueSignals,
    matchedShopId: args.matchedShop?.id ?? null,
    matchedShopName: args.matchedShop?.name ?? null,
  };
}

async function loadShopById(admin: any, shopId: string): Promise<ShopRecord | null> {
  if (!shopId) return null;

  const excluded = new Set<string>();
  for (let attempt = 0; attempt < OPTIONAL_SHOP_COLUMNS.length + 3; attempt++) {
    const selectCols = ["id", "name", ...OPTIONAL_SHOP_COLUMNS.filter((col) => !excluded.has(col))].join(",");
    const { data, error } = await admin.from(SHOP_TABLE).select(selectCols).eq("id", shopId).maybeSingle();
    if (!error) return data ? toShopRecord(data) : null;

    const msg = formatSbError(error);
    const col = tryExtractMissingColumn(msg);
    if (col && OPTIONAL_SHOP_COLUMNS.includes(col as any)) {
      excluded.add(col);
      continue;
    }

    throw new Error(`[${SHOP_TABLE}] ${msg}`);
  }

  throw new Error(`[${SHOP_TABLE}] Load failed after stripping optional columns.`);
}

async function findShopByColumn(admin: any, column: string, value: string): Promise<ShopRecord | null> {
  if (!value) return null;

  const excluded = new Set<string>();
  for (let attempt = 0; attempt < OPTIONAL_SHOP_COLUMNS.length + 3; attempt++) {
    const selectCols = ["id", "name", ...OPTIONAL_SHOP_COLUMNS.filter((col) => !excluded.has(col))].join(",");
    const { data, error } = await admin.from(SHOP_TABLE).select(selectCols).eq(column, value).limit(1).maybeSingle();
    if (!error) return data ? toShopRecord(data) : null;

    const msg = formatSbError(error);
    const col = tryExtractMissingColumn(msg);
    if (col && OPTIONAL_SHOP_COLUMNS.includes(col as any)) {
      excluded.add(col);
      continue;
    }

    throw new Error(`[${SHOP_TABLE}] ${msg}`);
  }

  throw new Error(`[${SHOP_TABLE}] Lookup failed after stripping optional columns.`);
}

async function loadMembershipShops(admin: any, userId: string): Promise<ShopRecord[]> {
  if (!userId) return [];

  const { data, error } = await admin.from(MEMBER_TABLE).select("shop_id").eq("user_id", userId).limit(50);
  if (error) throw new Error(`[${MEMBER_TABLE}] ${formatSbError(error)}`);

  const shopIds: string[] = Array.from(new Set((data ?? []).map((row: any) => s(row?.shop_id)).filter(Boolean) as string[]));
  const shops: ShopRecord[] = [];
  for (const shopId of shopIds) {
    const shop = await loadShopById(admin, shopId);
    if (shop?.id) shops.push(shop);
  }

  return shops;
}

async function findHistoryByField(admin: any, field: "user_id" | "device_id" | "email_hash" | "phone_hash", value: string) {
  if (!value) return null;

  const { data, error } = await admin
    .from(HISTORY_TABLE)
    .select("source_shop_id,shop_name,outcome,eligibility_reason,device_id,email_hash,phone_hash,user_id")
    .eq(field, value)
    .order("consumed_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (relationMissing(error)) return null;
    throw new Error(`[${HISTORY_TABLE}] ${formatSbError(error)}`);
  }

  return data ?? null;
}

export function deriveTrialOutcome(args: {
  billingStatus?: string | null;
  trialRestricted?: boolean | null;
  trialEligibilityReason?: string | null;
}) {
  const reason = s(args.trialEligibilityReason).toLowerCase();
  const status = normalizeBillingStatus(args.billingStatus);
  const restricted = Boolean(args.trialRestricted);

  if (reason === "clean_trial") return "clean_trial" as const;
  if (reason.includes("billing") || reason.includes("paid") || status === "restricted") {
    return restricted ? (reason.includes("billing") || reason.includes("paid") ? "billing_required" : "restricted_trial") : "billing_required";
  }
  if (restricted) return "restricted_trial" as const;
  return "clean_trial" as const;
}

export async function evaluateTrialEligibility(args: {
  userId: string;
  deviceId?: string | null;
  emailHash?: string | null;
  phoneHash?: string | null;
}): Promise<TrialEligibilityResult> {
  const admin = supabaseAdmin();
  const membershipShops = await loadMembershipShops(admin, args.userId);
  const paidHistoryShop = membershipShops.find((shop) => isPaidHistoryShop(shop));
  if (paidHistoryShop) {
    return buildResult({
      outcome: "billing_required",
      reason: "prior_paid_billing_history",
      primarySignal: paidHistoryShop.stripe_customer_id ? "billing_customer" : "billing_subscription",
      matchedShop: paidHistoryShop,
      extraSignals: ["auth_user_id", "existing_membership"],
    });
  }

  if (membershipShops.length > 0) {
    return buildResult({
      outcome: "restricted_trial",
      reason: "existing_membership",
      primarySignal: "existing_membership",
      matchedShop: membershipShops[0],
      extraSignals: ["auth_user_id"],
    });
  }

  const historyUser = await findHistoryByField(admin, "user_id", args.userId);
  if (historyUser) {
    const matchedShop = historyUser.source_shop_id ? await loadShopById(admin, String(historyUser.source_shop_id)) : null;
    const historyOutcome = s(historyUser.outcome).toLowerCase() === "billing_required" ? "billing_required" : "restricted_trial";
    return buildResult({
      outcome: historyOutcome as TrialOutcome,
      reason: s(historyUser.eligibility_reason) || "prior_trial_user_history",
      primarySignal: "auth_user_id",
      matchedShop,
    });
  }

  const deviceMatch = args.deviceId ? (await findHistoryByField(admin, "device_id", args.deviceId)) ?? (await findShopByColumn(admin, "trial_device_id", args.deviceId)) : null;
  if (deviceMatch) {
    const matchedShop = "source_shop_id" in (deviceMatch as any)
      ? ((deviceMatch as any).source_shop_id ? await loadShopById(admin, String((deviceMatch as any).source_shop_id)) : null)
      : (deviceMatch as ShopRecord);
    return buildResult({
      outcome: "restricted_trial",
      reason: s((deviceMatch as any).eligibility_reason) || "prior_trial_device",
      primarySignal: "device_id",
      matchedShop,
    });
  }

  const emailMatch = args.emailHash ? (await findHistoryByField(admin, "email_hash", args.emailHash)) ?? (await findShopByColumn(admin, "trial_email_hash", args.emailHash)) : null;
  if (emailMatch) {
    const matchedShop = "source_shop_id" in (emailMatch as any)
      ? ((emailMatch as any).source_shop_id ? await loadShopById(admin, String((emailMatch as any).source_shop_id)) : null)
      : (emailMatch as ShopRecord);
    return buildResult({
      outcome: "restricted_trial",
      reason: s((emailMatch as any).eligibility_reason) || "prior_trial_email",
      primarySignal: "email_hash",
      matchedShop,
    });
  }

  const phoneMatch = args.phoneHash ? (await findHistoryByField(admin, "phone_hash", args.phoneHash)) ?? (await findShopByColumn(admin, "trial_phone_hash", args.phoneHash)) : null;
  if (phoneMatch) {
    const matchedShop = "source_shop_id" in (phoneMatch as any)
      ? ((phoneMatch as any).source_shop_id ? await loadShopById(admin, String((phoneMatch as any).source_shop_id)) : null)
      : (phoneMatch as ShopRecord);
    return buildResult({
      outcome: "restricted_trial",
      reason: s((phoneMatch as any).eligibility_reason) || "prior_trial_phone",
      primarySignal: "phone_hash",
      matchedShop,
    });
  }

  return baseCleanResult();
}

export async function recordTrialUsage(args: {
  shopId: string;
  shopName: string;
  userId: string;
  deviceId?: string | null;
  emailHash?: string | null;
  phoneHash?: string | null;
  outcome: TrialOutcome;
  eligibilityReason: string;
}) {
  const admin = supabaseAdmin();
  const payload = {
    source_shop_id: args.shopId,
    shop_name: args.shopName,
    user_id: args.userId,
    device_id: args.deviceId ?? null,
    email_hash: args.emailHash ?? null,
    phone_hash: args.phoneHash ?? null,
    outcome: args.outcome,
    eligibility_reason: args.eligibilityReason,
    consumed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error } = await admin.from(HISTORY_TABLE).insert(payload);
  if (error && !relationMissing(error)) {
    throw new Error(`[${HISTORY_TABLE}] ${formatSbError(error)}`);
  }
}

