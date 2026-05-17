import { loadBillingViews } from "@/lib/control/billingViews";
import { getViewerContext, type ViewerContext } from "@/lib/control/summary";
import { SHOP_MOBILE_TIMECLOCK_SELECT_COLUMNS } from "@/lib/mobileTimeclockPolicy";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

export type SettingsViewsData = {
  context: ViewerContext;
  noviceOn: boolean;
  mfaRequired: boolean;
  currentAal: "aal1" | "aal2" | "aal3";
  policies: {
    update: {
      totalPolicies: number;
      channels: string[];
      minimumCount: number;
      pinnedCount: number;
      packagesCount: number;
    };
    mobile: {
      enabledShops: number;
      policyModes: string[];
      pendingReviewModeCount: number;
    };
    billing: {
      trialing: number;
      restricted: number;
      fullAccess: number;
    };
    webhooks: {
      stripeWebhookConfigured: boolean;
      webhookEventsAvailable: boolean;
      webhookEventCount: number | null;
    };
    diagnostics: {
      serviceRolePresent: boolean;
      stripeSecretPresent: boolean;
      stripePricePresent: boolean;
    };
  };
};

type UserPrefsRow = {
  novice_dismissed: boolean | null;
};

type UpdatePolicyDbRow = {
  shop_id: string | null;
  channel: string | null;
  min_version: string | null;
  pinned_version: string | null;
};

type MobilePolicyDbRow = {
  id: string | null;
  name: string | null;
  mobile_timeclock_enabled: boolean | null;
  mobile_punch_policy: string | null;
  mobile_punch_failure_mode: string | null;
  mobile_geofence_lat?: number | null;
  mobile_geofence_lng?: number | null;
  mobile_allowed_network_cidrs?: string[] | null;
};

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asText(value: unknown) {
  return String(value ?? "").trim();
}

function tryExtractMissingColumn(message: string): string | null {
  const relationMatch = message.match(/column\s+"([^"]+)"\s+of\s+relation/i);
  if (relationMatch?.[1]) return relationMatch[1];

  const schemaCacheMatch = message.match(/Could not find the '([^']+)' column/i);
  if (schemaCacheMatch?.[1]) return schemaCacheMatch[1];

  const qualifiedMatch = message.match(/column\s+[a-zA-Z0-9_]+\.(\w+)\s+does\s+not\s+exist/i);
  if (qualifiedMatch?.[1]) return qualifiedMatch[1];

  return null;
}

async function countWhere(admin: ReturnType<typeof supabaseAdmin>, table: string) {
  const { count, error } = await admin.from(table).select("id", { count: "exact", head: true });
  if (error) return null;
  return count ?? 0;
}

async function loadUpdatePolicyRows(shopIds: string[]) {
  const ids = [...new Set(shopIds.filter(Boolean))];
  if (ids.length === 0) return [] as UpdatePolicyDbRow[];
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("rb_update_policy")
    .select("shop_id,channel,min_version,pinned_version")
    .in("shop_id", ids);

  if (error) return [] as UpdatePolicyDbRow[];
  return asArray<UpdatePolicyDbRow>(data);
}

async function loadUpdatePackageCount() {
  const admin = supabaseAdmin();
  const count = await countWhere(admin, "rb_update_packages");
  return count ?? 0;
}

async function loadMobilePolicyRows(shopIds: string[]) {
  const ids = [...new Set(shopIds.filter(Boolean))];
  if (ids.length === 0) return [] as MobilePolicyDbRow[];

  const admin = supabaseAdmin();
  let working: string[] = [...SHOP_MOBILE_TIMECLOCK_SELECT_COLUMNS];
  for (let attempt = 0; attempt < SHOP_MOBILE_TIMECLOCK_SELECT_COLUMNS.length; attempt += 1) {
    const { data, error } = await admin
      .from("rb_shops")
      .select(working.join(","))
      .in("id", ids)
      .limit(1000);

    if (!error) return asArray<MobilePolicyDbRow>(data);

    const missing = tryExtractMissingColumn(String(error.message ?? ""));
    if (missing && working.includes(missing)) {
      working = working.filter((column) => column !== missing);
      continue;
    }
    return [] as MobilePolicyDbRow[];
  }

  return [] as MobilePolicyDbRow[];
}

async function loadWebhookEventCount() {
  const admin = supabaseAdmin();
  try {
    const count = await countWhere(admin, "rb_webhook_events");
    return { available: count !== null, count };
  } catch {
    return { available: false, count: null };
  }
}

export async function loadSettingsViews(): Promise<SettingsViewsData> {
  const [context, supabase, billingViews] = await Promise.all([
    getViewerContext(),
    supabaseServer(),
    loadBillingViews(),
  ]);

  const [{ data: prefs }, { data: aalData }, updatePolicies, packagesCount, mobilePolicies, webhookEvents] = await Promise.all([
    supabase.from("rb_user_prefs").select("novice_dismissed").maybeSingle<UserPrefsRow>(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    loadUpdatePolicyRows(context.shops.map((shop) => shop.id)),
    loadUpdatePackageCount(),
    loadMobilePolicyRows(context.shops.map((shop) => shop.id)),
    loadWebhookEventCount(),
  ]);

  const noviceDismissed = Boolean((prefs as UserPrefsRow | null)?.novice_dismissed);
  const channels = [...new Set(updatePolicies.map((row) => asText(row.channel) || "stable"))];
  const policyModes = [...new Set(mobilePolicies.map((row) => asText(row.mobile_punch_policy)).filter(Boolean))];
  const currentAal = ((aalData?.currentLevel as "aal1" | "aal2" | "aal3" | null) ?? "aal1");

  return {
    context,
    noviceOn: !noviceDismissed,
    mfaRequired: context.isPlatformAdmin,
    currentAal,
    policies: {
      update: {
        totalPolicies: updatePolicies.length,
        channels,
        minimumCount: updatePolicies.filter((row) => Boolean(asText(row.min_version))).length,
        pinnedCount: updatePolicies.filter((row) => Boolean(asText(row.pinned_version))).length,
        packagesCount,
      },
      mobile: {
        enabledShops: mobilePolicies.filter((row) => row.mobile_timeclock_enabled === true).length,
        policyModes,
        pendingReviewModeCount: mobilePolicies.filter((row) => asText(row.mobile_punch_failure_mode).toUpperCase() === "PENDING_REVIEW").length,
      },
      billing: {
        trialing: billingViews.summary.trialing,
        restricted: billingViews.summary.blockedOrSuspended,
        fullAccess: billingViews.summary.fullAccess,
      },
      webhooks: {
        stripeWebhookConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET && String(process.env.STRIPE_WEBHOOK_SECRET).trim()),
        webhookEventsAvailable: webhookEvents.available,
        webhookEventCount: webhookEvents.count,
      },
      diagnostics: {
        serviceRolePresent: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && String(process.env.SUPABASE_SERVICE_ROLE_KEY).trim()),
        stripeSecretPresent: Boolean(process.env.STRIPE_SECRET_KEY && String(process.env.STRIPE_SECRET_KEY).trim()),
        stripePricePresent: Boolean(process.env.STRIPE_PRICE_ID && String(process.env.STRIPE_PRICE_ID).trim()),
      },
    },
  };
}
