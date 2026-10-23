import React from "react";
import ControlDashboard, { limitedCount, orderAlerts, type AlertRow, type ActivityRow, type HealthRow } from "@/components/control/dashboard/ControlDashboard";
import { getPlatformSnapshot, getShopSnapshot, getViewerContext, type ShopSnapshot } from "@/lib/control/summary";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { formatDateTime } from "@/lib/ui/dates";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type TimeclockReviewDbRow = {
  shop_id: string | null;
};

type AuditActivityDbRow = {
  id: string | null;
  action: string | null;
  actor_email: string | null;
  shop_id: string | null;
  created_at: string | null;
};

type SupportSummaryDbRow = {
  created_at: string | null;
  file_path: string | null;
  shop_id: string | null;
};

type UpdateSummaryDbRow = {
  created_at: string | null;
  version: string | null;
};

type AuditSummaryDbRow = {
  created_at: string | null;
  action: string | null;
  shop_id: string | null;
};

type SummaryPanelRow = {
  count: number;
  latest_at: string | null;
  latest_label: string | null;
};

type DashboardSummaryRows = {
  support: SummaryPanelRow;
  updates: SummaryPanelRow;
  audit: SummaryPanelRow & { recent_24h: number };
};

function formatMaybeDate(value: string | null | undefined) {
  if (!value) return "Not available";
  try {
    return formatDateTime(value);
  } catch {
    return value;
  }
}

async function loadTimeclockReviewCounts(shopIds: string[]) {
  if (shopIds.length === 0) return { counts: new Map<string, number>(), limited: false };
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("time_events")
    .select("shop_id")
    .eq("needs_review", true)
    .in("shop_id", shopIds)
    .limit(1000);
  if (error) return { counts: new Map<string, number>(), limited: false };

  const counts = new Map<string, number>();
  for (const row of (data ?? []) as TimeclockReviewDbRow[]) {
    const key = String(row.shop_id ?? "").trim();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return { counts, limited: (data ?? []).length >= 1000 };
}

async function loadRecentActivity(shopIds: string[]) {
  if (shopIds.length === 0) return [] as ActivityRow[];
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("rb_audit_log")
    .select("id,action,actor_email,shop_id,created_at")
    .in("shop_id", shopIds)
    .order("created_at", { ascending: false })
    .limit(8);
  if (error) return [] as ActivityRow[];

  return ((data ?? []) as AuditActivityDbRow[]).map((row) => ({
    id: String(row.id ?? ""),
    action: String(row.action ?? "event"),
    actor: String(row.actor_email ?? "System"),
    scope: String(row.shop_id ?? ""),
    created_at: row.created_at ?? null,
  }));
}

async function loadSummaryRows(shopIds: string[]): Promise<DashboardSummaryRows> {
  const admin = supabaseAdmin();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [support, updates, audit] = await Promise.all([
    shopIds.length === 0
      ? Promise.resolve({ data: [] as SupportSummaryDbRow[], error: null as { message?: string } | null })
      : admin
          .from("rb_support_bundles")
          .select("created_at,file_path,shop_id")
          .in("shop_id", shopIds)
          .order("created_at", { ascending: false })
          .limit(50),
    admin
      .from("rb_update_packages")
      .select("created_at,version")
      .order("created_at", { ascending: false })
      .limit(50),
    shopIds.length === 0
      ? Promise.resolve({ data: [] as AuditSummaryDbRow[], error: null as { message?: string } | null })
      : admin
          .from("rb_audit_log")
          .select("created_at,action,shop_id")
          .in("shop_id", shopIds)
          .gte("created_at", since24h)
          .order("created_at", { ascending: false })
          .limit(200),
  ]);

  const supportRows: SupportSummaryDbRow[] = support.error ? [] : ((support.data ?? []) as SupportSummaryDbRow[]);
  const updateRows: UpdateSummaryDbRow[] = updates.error ? [] : ((updates.data ?? []) as UpdateSummaryDbRow[]);
  const auditRows: AuditSummaryDbRow[] = audit.error ? [] : ((audit.data ?? []) as AuditSummaryDbRow[]);

  return {
    support: {
      count: supportRows.length,
      latest_at: supportRows[0]?.created_at ?? null,
      latest_label: supportRows[0]?.file_path ? String(supportRows[0].file_path).split("/").filter(Boolean).pop() ?? null : null,
    },
    updates: {
      count: updateRows.length,
      latest_at: updateRows[0]?.created_at ?? null,
      latest_label: updateRows[0]?.version ?? null,
    },
    audit: {
      count: auditRows.length,
      latest_at: auditRows[0]?.created_at ?? null,
      latest_label: auditRows[0]?.action ?? null,
      recent_24h: auditRows.length,
    },
  };
}

function buildAlerts(
  snapshots: ShopSnapshot[],
  timeclockReviews: Map<string, number>,
  timeclockLimited: boolean,
) {
  const alerts: AlertRow[] = [];

  for (const snapshot of snapshots) {
    if (snapshot.access.state === "restricted" || snapshot.access.state === "expired" || snapshot.access.state === "grace") {
      alerts.push({
        key: `${snapshot.id}:billing`,
        priority: "Critical",
        type: "Billing / access restriction",
        scope: snapshot.name,
        detail: snapshot.access.summary,
        source: snapshot.access.reason,
        href: "/billing-access",
      });
    }

    if (snapshot.health.offline_devices > 0) {
      alerts.push({
        key: `${snapshot.id}:offline`,
        priority: "High",
        type: "Offline devices",
        scope: snapshot.name,
        detail: `${snapshot.health.offline_devices} offline device${snapshot.health.offline_devices === 1 ? "" : "s"} need review.`,
        source: "rb_devices + rb_device_tokens",
        href: `/shops/${snapshot.id}?tab=devices`,
      });
    }

    if (snapshot.health.stale_devices > 0 && snapshot.health.offline_devices === 0) {
      alerts.push({
        key: `${snapshot.id}:stale`,
        priority: "Medium",
        type: "Stale devices",
        scope: snapshot.name,
        detail: `${snapshot.health.stale_devices} stale device${snapshot.health.stale_devices === 1 ? "" : "s"} have not checked in recently.`,
        source: "rb_devices + rb_device_tokens",
        href: `/shops/${snapshot.id}?tab=devices`,
      });
    }

    const blockedWorkstations = snapshot.access.workstation_mode === "full" ? 0 : snapshot.counts.workstations_active;
    if (blockedWorkstations > 0) {
      alerts.push({
        key: `${snapshot.id}:workstation`,
        priority: "High",
        type: "Workstations blocked",
        scope: snapshot.name,
        detail: `${blockedWorkstations} active workstation${blockedWorkstations === 1 ? "" : "s"} are currently blocked by access policy.`,
        source: snapshot.access.reason,
        href: "/workstations",
      });
    }

    const mobileReviews = timeclockReviews.get(snapshot.id) ?? 0;
    if (mobileReviews > 0) {
      alerts.push({
        key: `${snapshot.id}:timeclock`,
        priority: "Medium",
        type: "Timeclock review",
        scope: snapshot.name,
        detail: `${mobileReviews}${timeclockLimited ? "+" : ""} timeclock event${mobileReviews === 1 ? "" : "s"} are pending review.`,
        source: "time_events.needs_review",
        href: "/timeclock-review",
      });
    }
  }

  return orderAlerts(alerts);
}

function buildHealthRows(args: {
  snapshots: ShopSnapshot[];
  totalOfflineDevices: number;
  blockedWorkstations: number;
  mobileReviewCount: number;
  mobileReviewLimited: boolean;
}): HealthRow[] {
  const restrictedShops = args.snapshots.filter((shop) => shop.access.state === "restricted" || shop.access.state === "expired").length;
  const graceShops = args.snapshots.filter((shop) => shop.access.state === "grace").length;
  const attentionShops = args.snapshots.filter((shop) =>
    shop.access.state === "restricted" ||
    shop.access.state === "expired" ||
    shop.access.state === "grace" ||
    shop.health.offline_devices > 0 ||
    shop.health.stale_devices > 0
  ).length;

  return [
    {
      service: "Cloud access",
      status: attentionShops === 0 ? "Operational" : "Needs attention",
      tone: attentionShops === 0 ? "success" : "warning",
      detail: `${attentionShops} of ${args.snapshots.length} shop scopes currently need review.`,
    },
    {
      service: "Billing & plans",
      status: restrictedShops === 0 && graceShops === 0 ? "Operational" : restrictedShops > 0 ? "Restricted" : "Grace active",
      tone: restrictedShops > 0 ? "danger" : graceShops > 0 ? "warning" : "success",
      detail: `${restrictedShops} restricted/expired, ${graceShops} in grace.`,
    },
    {
      service: "Device check-ins",
      status: args.totalOfflineDevices === 0 ? "Operational" : "Offline devices",
      tone: args.totalOfflineDevices === 0 ? "success" : "danger",
      detail: `${args.totalOfflineDevices} offline device${args.totalOfflineDevices === 1 ? "" : "s"} across authorized scope.`,
    },
    {
      service: "Workstation access",
      status: args.blockedWorkstations === 0 ? "Operational" : "Blocked",
      tone: args.blockedWorkstations === 0 ? "success" : "warning",
      detail: `${args.blockedWorkstations} active workstation${args.blockedWorkstations === 1 ? "" : "s"} currently blocked.`,
    },
    {
      service: "Timeclock",
      status: args.mobileReviewCount === 0 ? "Operational" : "Pending review",
      tone: args.mobileReviewCount === 0 ? "success" : "warning",
      detail: `${args.mobileReviewCount}${args.mobileReviewLimited ? "+" : ""} timeclock review item${args.mobileReviewCount === 1 ? "" : "s"} pending.`,
    },
  ];
}

export default async function DashboardPage() {
  const context = await getViewerContext();
  const snapshots = await Promise.all(context.shops.map((shop) => getShopSnapshot(shop)));
  const shopIds = snapshots.map((shop) => shop.id);
  const platformSnapshot = await getPlatformSnapshot(context);
  const [timeclockReviews, recentActivity, summaryRows] = await Promise.all([
    loadTimeclockReviewCounts(shopIds),
    loadRecentActivity(shopIds),
    loadSummaryRows(shopIds),
  ]);

  const attentionShops = snapshots.filter((shop) =>
    shop.access.state === "restricted" ||
    shop.access.state === "expired" ||
    shop.access.state === "grace" ||
    shop.health.offline_devices > 0 ||
    shop.health.stale_devices > 0
  );
  const totalOfflineDevices = snapshots.reduce((sum, shop) => sum + shop.health.offline_devices, 0);
  const blockedWorkstations = snapshots.reduce(
    (sum, shop) => sum + (shop.access.workstation_mode === "full" ? 0 : shop.counts.workstations_active),
    0
  );
  const mobileReviewCount = Array.from(timeclockReviews.counts.values()).reduce((sum, count) => sum + count, 0);
  const totalActiveDevices = snapshots.reduce((sum, shop) => sum + shop.counts.devices_active, 0);
  const totalActiveWorkstations = snapshots.reduce((sum, shop) => sum + shop.counts.workstations_active, 0);
  const totalMobileReady = snapshots.reduce((sum, shop) => sum + shop.counts.employees_mobile_ready, 0);
  const alerts = buildAlerts(snapshots, timeclockReviews.counts, timeclockReviews.limited);
  const healthRows = buildHealthRows({ snapshots, totalOfflineDevices, blockedWorkstations, mobileReviewCount, mobileReviewLimited: timeclockReviews.limited });

  const reviewCount = `${mobileReviewCount}${timeclockReviews.limited ? "+" : ""}`;
  return <ControlDashboard
    metrics={[
      { label: "Shops needing attention", value: String(attentionShops.length), meta: "Review access and device health", tone: attentionShops.length > 0 ? "danger" : "success", href: "/shops" },
      { label: "Devices offline", value: String(totalOfflineDevices), meta: "Devices that need a check-in", tone: totalOfflineDevices > 0 ? "danger" : "success", href: "/devices" },
      { label: "Workstations blocked", value: String(blockedWorkstations), meta: "Access policy needs review", tone: blockedWorkstations > 0 ? "warning" : "success", href: "/workstations" },
      { label: "Timeclock review", value: reviewCount, meta: "Events awaiting review", tone: mobileReviewCount > 0 ? "warning" : "info", href: "/timeclock-review" },
    ]}
    summary={[
      { label: "shops", value: String(platformSnapshot.manageableShopCount), href: "/shops" },
      { label: "active devices", value: String(totalActiveDevices), href: "/devices" },
      { label: "workstations", value: String(totalActiveWorkstations), href: "/workstations" },
      { label: "mobile-ready employees", value: String(totalMobileReady), href: "/people" },
      { label: "audit events / 24h", value: limitedCount(summaryRows.audit.recent_24h, 200), href: "/audit" },
    ]}
    alerts={alerts}
    healthRows={healthRows}
    recentActivity={recentActivity}
    shortcuts={[
      { title: "Support", href: "/support", detail: `${limitedCount(summaryRows.support.count, 50)} bundles in recent records`, latest: summaryRows.support.latest_at ? `Latest: ${summaryRows.support.latest_label ?? "bundle"} - ${formatMaybeDate(summaryRows.support.latest_at)}` : "No support bundle metadata in current scope." },
      { title: "Software updates (platform-wide)", href: "/updates", detail: `${limitedCount(summaryRows.updates.count, 50)} packages in recent records`, latest: summaryRows.updates.latest_at ? `Latest: ${summaryRows.updates.latest_label ?? "unknown"} - ${formatMaybeDate(summaryRows.updates.latest_at)}` : "No update-package metadata available." },
      { title: "Audit log", href: "/audit", detail: "Browse recent activity", latest: summaryRows.audit.latest_at ? `Latest: ${summaryRows.audit.latest_label ?? "event"} - ${formatMaybeDate(summaryRows.audit.latest_at)}` : "No audit rows in current scope." },
    ]}
  />;
}
