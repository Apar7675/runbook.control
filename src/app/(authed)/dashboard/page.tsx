import React from "react";
import { ControlActionLink } from "@/components/control/ControlActionButton";
import ControlEmptyState from "@/components/control/ControlEmptyState";
import ControlMetricCard from "@/components/control/ControlMetricCard";
import ControlPageHeader from "@/components/control/ControlPageHeader";
import ControlPanel from "@/components/control/ControlPanel";
import ControlStatusChip, { type ControlStatusTone } from "@/components/control/ControlStatusChip";
import { ControlTable, ControlTableCell, ControlTableHeadCell, ControlTableWrap } from "@/components/control/ControlTable";
import { controlTheme as t } from "@/components/control/controlTheme";
import { getPlatformSnapshot, getShopSnapshot, getViewerContext, type ShopSnapshot } from "@/lib/control/summary";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { formatDateTime } from "@/lib/ui/dates";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AlertRow = {
  key: string;
  priority: "Critical" | "High" | "Medium" | "Low";
  type: string;
  scope: string;
  detail: string;
  source: string;
  href: string;
};

type ActivityRow = {
  id: string;
  action: string;
  actor: string;
  scope: string;
  created_at: string | null;
};

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
  support: SummaryPanelRow & { recent_30d: number };
  updates: SummaryPanelRow & { recent_30d: number };
  audit: SummaryPanelRow & { recent_24h: number };
};

type HealthRow = {
  service: string;
  status: string;
  tone: ControlStatusTone;
  detail: string;
};

function safeDate(value: string | null | undefined) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const ms = Date.parse(text);
  return Number.isFinite(ms) ? ms : null;
}

function newestIso(...values: Array<string | null | undefined>) {
  let winner: string | null = null;
  for (const value of values) {
    const ms = safeDate(value);
    if (ms === null) continue;
    if (!winner || ms > (safeDate(winner) ?? 0)) winner = String(value);
  }
  return winner;
}

function formatMaybeDate(value: string | null | undefined) {
  if (!value) return "Not available";
  try {
    return formatDateTime(value);
  } catch {
    return value;
  }
}

function toneFromPriority(priority: AlertRow["priority"]) {
  if (priority === "Critical") return "danger" as const;
  if (priority === "High") return "danger" as const;
  if (priority === "Medium") return "warning" as const;
  return "info" as const;
}

async function loadTimeclockReviewCounts(shopIds: string[]) {
  if (shopIds.length === 0) return new Map<string, number>();
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("time_events")
    .select("shop_id")
    .eq("needs_review", true)
    .in("shop_id", shopIds)
    .limit(1000);
  if (error) return new Map<string, number>();

  const counts = new Map<string, number>();
  for (const row of (data ?? []) as TimeclockReviewDbRow[]) {
    const key = String(row.shop_id ?? "").trim();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
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
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
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

  const supportRecent = supportRows.filter((row) => {
    const created = safeDate(row.created_at);
    return created !== null && created >= (safeDate(since30d) ?? 0);
  });
  const updateRecent = updateRows.filter((row) => {
    const created = safeDate(row.created_at);
    return created !== null && created >= (safeDate(since30d) ?? 0);
  });

  return {
    support: {
      count: supportRows.length,
      latest_at: supportRows[0]?.created_at ?? null,
      latest_label: supportRows[0]?.file_path ? String(supportRows[0].file_path).split("/").filter(Boolean).pop() ?? null : null,
      recent_30d: supportRecent.length,
    },
    updates: {
      count: updateRows.length,
      latest_at: updateRows[0]?.created_at ?? null,
      latest_label: updateRows[0]?.version ?? null,
      recent_30d: updateRecent.length,
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
        href: "/apps?app=workstation",
      });
    }

    const mobileReviews = timeclockReviews.get(snapshot.id) ?? 0;
    if (mobileReviews > 0) {
      alerts.push({
        key: `${snapshot.id}:timeclock`,
        priority: "Medium",
        type: "Timeclock review",
        scope: snapshot.name,
        detail: `${mobileReviews} timeclock event${mobileReviews === 1 ? "" : "s"} are pending review.`,
        source: "time_events.needs_review",
        href: "/audit?action=timeclock",
      });
    }
  }

  return alerts.slice(0, 12);
}

function buildHealthRows(args: {
  snapshots: ShopSnapshot[];
  totalOfflineDevices: number;
  blockedWorkstations: number;
  mobileReviewCount: number;
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
      service: "Cloud authority scope",
      status: attentionShops === 0 ? "Operational" : "Needs attention",
      tone: attentionShops === 0 ? "success" : "warning",
      detail: `${attentionShops} of ${args.snapshots.length} shop scopes currently need review.`,
    },
    {
      service: "Billing & entitlement",
      status: restrictedShops === 0 && graceShops === 0 ? "Operational" : restrictedShops > 0 ? "Restricted" : "Grace active",
      tone: restrictedShops > 0 ? "danger" : graceShops > 0 ? "warning" : "success",
      detail: `${restrictedShops} restricted/expired, ${graceShops} in grace.`,
    },
    {
      service: "Device heartbeat",
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
      service: "Mobile review queue",
      status: args.mobileReviewCount === 0 ? "Operational" : "Pending review",
      tone: args.mobileReviewCount === 0 ? "success" : "warning",
      detail: `${args.mobileReviewCount} timeclock review item${args.mobileReviewCount === 1 ? "" : "s"} pending.`,
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
  const mobileReviewCount = Array.from(timeclockReviews.values()).reduce((sum, count) => sum + count, 0);
  const totalActiveDevices = snapshots.reduce((sum, shop) => sum + shop.counts.devices_active, 0);
  const totalActiveWorkstations = snapshots.reduce((sum, shop) => sum + shop.counts.workstations_active, 0);
  const totalMobileReady = snapshots.reduce((sum, shop) => sum + shop.counts.employees_mobile_ready, 0);
  const alerts = buildAlerts(snapshots, timeclockReviews);
  const healthRows = buildHealthRows({ snapshots, totalOfflineDevices, blockedWorkstations, mobileReviewCount });
  const latestActivityAt = newestIso(...recentActivity.map((row) => row.created_at));

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <ControlPageHeader
        eyebrow="Phase 1"
        title="Command Center"
        description="Cloud authority for shops, devices, billing, access, and support operations. This page only shows real server-side data within the current authorized scope."
        actions={
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, color: t.color.textMuted, fontSize: 13 }}>
              <span>{latestActivityAt ? `Latest activity ${formatMaybeDate(latestActivityAt)}` : "No recent activity logged"}</span>
            </div>
            <ControlActionLink href="/dashboard" tone="primary">
              Refresh
            </ControlActionLink>
          </>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
        <ControlMetricCard
          label="Shops Needing Attention"
          value={String(attentionShops.length)}
          meta={`${snapshots.length} authorized shop scopes checked.`}
          tone={attentionShops.length > 0 ? "danger" : "success"}
          href="/shops"
        />
        <ControlMetricCard
          label="Devices Offline"
          value={String(totalOfflineDevices)}
          meta={`${totalActiveDevices} active devices across current scope.`}
          tone={totalOfflineDevices > 0 ? "danger" : "success"}
          href="/devices"
        />
        <ControlMetricCard
          label="Workstations Blocked"
          value={String(blockedWorkstations)}
          meta={`${totalActiveWorkstations} active workstation records in scope.`}
          tone={blockedWorkstations > 0 ? "warning" : "success"}
          href="/apps?app=workstation"
        />
        <ControlMetricCard
          label="Mobile / Timeclock Review"
          value={String(mobileReviewCount)}
          meta={`${totalMobileReady} mobile-ready employees across current scope.`}
          tone={mobileReviewCount > 0 ? "warning" : "info"}
          href="/audit?action=timeclock"
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
        <ControlMetricCard label="Total Shops" value={String(platformSnapshot.manageableShopCount)} meta="Authorized shop workspaces." tone="info" href="/shops" />
        <ControlMetricCard label="Active Devices" value={String(totalActiveDevices)} meta="Merged from current shop snapshots." tone="info" href="/devices" />
        <ControlMetricCard label="Active Workstations" value={String(totalActiveWorkstations)} meta="Registered active workstation devices." tone="info" href="/apps?app=workstation" />
        <ControlMetricCard label="Mobile Ready Employees" value={String(totalMobileReady)} meta="Employees currently eligible for mobile access." tone="info" href="/people" />
        <ControlMetricCard label="Audit Events (24h)" value={String(summaryRows.audit.recent_24h)} meta="Recent audit rows within authorized scope." tone="info" href="/audit" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.8fr) minmax(360px, 1fr)", gap: 14 }}>
        <ControlPanel
          title="Alerts / Issues"
          description="Real issues inferred from billing/access state, device heartbeat, workstation blocks, and timeclock review rows."
          actions={<ControlActionLink href="/shops">Open shops</ControlActionLink>}
        >
          {alerts.length === 0 ? (
            <ControlEmptyState
              title="No active issues in current scope"
              description="The current authorized shop scope does not show billing restrictions, offline devices, blocked workstations, or mobile review rows right now."
            />
          ) : (
            <ControlTableWrap>
              <ControlTable minWidth={980}>
                <thead>
                  <tr>
                    <ControlTableHeadCell>Priority</ControlTableHeadCell>
                    <ControlTableHeadCell>Type</ControlTableHeadCell>
                    <ControlTableHeadCell>Scope</ControlTableHeadCell>
                    <ControlTableHeadCell>Detail</ControlTableHeadCell>
                    <ControlTableHeadCell>Source</ControlTableHeadCell>
                    <ControlTableHeadCell align="right">Next</ControlTableHeadCell>
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((alert) => (
                    <tr key={alert.key}>
                      <ControlTableCell><ControlStatusChip label={alert.priority} tone={toneFromPriority(alert.priority)} /></ControlTableCell>
                      <ControlTableCell>{alert.type}</ControlTableCell>
                      <ControlTableCell>{alert.scope}</ControlTableCell>
                      <ControlTableCell>{alert.detail}</ControlTableCell>
                      <ControlTableCell>{alert.source}</ControlTableCell>
                      <ControlTableCell align="right"><ControlActionLink href={alert.href}>Open</ControlActionLink></ControlTableCell>
                    </tr>
                  ))}
                </tbody>
              </ControlTable>
            </ControlTableWrap>
          )}
        </ControlPanel>

        <div style={{ display: "grid", gap: 14 }}>
          <ControlPanel
            title="Recent Activity"
            description="Latest audit events available inside the current authorized scope."
            actions={<ControlActionLink href="/audit">Audit log</ControlActionLink>}
          >
            {recentActivity.length === 0 ? (
              <ControlEmptyState
                title="No recent audit activity"
                description="No recent audit rows were returned for the current scope."
              />
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {recentActivity.map((row) => (
                  <div
                    key={row.id}
                    style={{
                      display: "grid",
                      gap: 4,
                      padding: "12px 14px",
                      borderRadius: 12,
                      border: `1px solid ${t.color.softBorder}`,
                      background: "rgba(7, 10, 15, 0.32)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                      <div style={{ color: t.color.text, fontWeight: 700 }}>{row.action}</div>
                      <div style={{ color: t.color.textMuted, fontSize: 12 }}>{formatMaybeDate(row.created_at)}</div>
                    </div>
                    <div style={{ color: t.color.textSecondary, fontSize: 13 }}>{row.actor}</div>
                    <div style={{ color: t.color.textMuted, fontSize: 12 }}>{row.scope || "System scope"}</div>
                  </div>
                ))}
              </div>
            )}
          </ControlPanel>

          <ControlPanel
            title="System Health"
            description="Health rows are derived from real authorized-scope billing, device, workstation, and review data."
            actions={<ControlActionLink href="/status">Status</ControlActionLink>}
          >
            <ControlTableWrap>
              <ControlTable>
                <thead>
                  <tr>
                    <ControlTableHeadCell>Service</ControlTableHeadCell>
                    <ControlTableHeadCell>Status</ControlTableHeadCell>
                    <ControlTableHeadCell>Detail</ControlTableHeadCell>
                  </tr>
                </thead>
                <tbody>
                  {healthRows.map((row) => (
                    <tr key={row.service}>
                      <ControlTableCell>{row.service}</ControlTableCell>
                      <ControlTableCell><ControlStatusChip label={row.status} tone={row.tone} /></ControlTableCell>
                      <ControlTableCell>{row.detail}</ControlTableCell>
                    </tr>
                  ))}
                </tbody>
              </ControlTable>
            </ControlTableWrap>
          </ControlPanel>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
        <ControlPanel
          title="Support Summary"
          description="Support-bundle metadata recorded in Control."
          actions={<ControlActionLink href="/support">Support</ControlActionLink>}
        >
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
              <div style={{ padding: 12, borderRadius: 12, border: `1px solid ${t.color.softBorder}`, background: "rgba(7, 10, 15, 0.28)" }}>
                <div style={{ color: t.color.textMuted, fontSize: 12 }}>Bundles in scope</div>
                <div style={{ color: t.color.text, fontSize: 28, fontWeight: 800 }}>{summaryRows.support.count}</div>
              </div>
              <div style={{ padding: 12, borderRadius: 12, border: `1px solid ${t.color.softBorder}`, background: "rgba(7, 10, 15, 0.28)" }}>
                <div style={{ color: t.color.textMuted, fontSize: 12 }}>Recent 30d</div>
                <div style={{ color: t.color.text, fontSize: 28, fontWeight: 800 }}>{summaryRows.support.recent_30d}</div>
              </div>
            </div>
            <div style={{ color: t.color.textSecondary, fontSize: 13 }}>
              {summaryRows.support.latest_at
                ? `Latest bundle ${summaryRows.support.latest_label ?? "record"} logged ${formatMaybeDate(summaryRows.support.latest_at)}.`
                : "No support bundle metadata has been recorded for the current scope yet."}
            </div>
          </div>
        </ControlPanel>

        <ControlPanel
          title="Updates"
          description="Update-package metadata managed by Control."
          actions={<ControlActionLink href="/updates">Updates</ControlActionLink>}
        >
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
              <div style={{ padding: 12, borderRadius: 12, border: `1px solid ${t.color.softBorder}`, background: "rgba(7, 10, 15, 0.28)" }}>
                <div style={{ color: t.color.textMuted, fontSize: 12 }}>Packages tracked</div>
                <div style={{ color: t.color.text, fontSize: 28, fontWeight: 800 }}>{summaryRows.updates.count}</div>
              </div>
              <div style={{ padding: 12, borderRadius: 12, border: `1px solid ${t.color.softBorder}`, background: "rgba(7, 10, 15, 0.28)" }}>
                <div style={{ color: t.color.textMuted, fontSize: 12 }}>Published 30d</div>
                <div style={{ color: t.color.text, fontSize: 28, fontWeight: 800 }}>{summaryRows.updates.recent_30d}</div>
              </div>
            </div>
            <div style={{ color: t.color.textSecondary, fontSize: 13 }}>
              {summaryRows.updates.latest_at
                ? `Latest package ${summaryRows.updates.latest_label ?? "unknown"} published ${formatMaybeDate(summaryRows.updates.latest_at)}.`
                : "No update-package metadata is available yet."}
            </div>
          </div>
        </ControlPanel>

        <ControlPanel
          title="Audit Summary"
          description="Recent audit activity within the current authorized scope."
          actions={<ControlActionLink href="/audit">Audit log</ControlActionLink>}
        >
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
              <div style={{ padding: 12, borderRadius: 12, border: `1px solid ${t.color.softBorder}`, background: "rgba(7, 10, 15, 0.28)" }}>
                <div style={{ color: t.color.textMuted, fontSize: 12 }}>Events 24h</div>
                <div style={{ color: t.color.text, fontSize: 28, fontWeight: 800 }}>{summaryRows.audit.recent_24h}</div>
              </div>
              <div style={{ padding: 12, borderRadius: 12, border: `1px solid ${t.color.softBorder}`, background: "rgba(7, 10, 15, 0.28)" }}>
                <div style={{ color: t.color.textMuted, fontSize: 12 }}>Manageable shops</div>
                <div style={{ color: t.color.text, fontSize: 28, fontWeight: 800 }}>{platformSnapshot.manageableShopCount}</div>
              </div>
            </div>
            <div style={{ color: t.color.textSecondary, fontSize: 13 }}>
              {summaryRows.audit.latest_at
                ? `Latest audit action ${summaryRows.audit.latest_label ?? "event"} at ${formatMaybeDate(summaryRows.audit.latest_at)}.`
                : "No audit rows were returned for the current scope."}
            </div>
          </div>
        </ControlPanel>
      </div>
    </div>
  );
}
