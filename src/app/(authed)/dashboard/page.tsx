import React from "react";
import { ControlActionButtonV2, ControlActionLinkV2 } from "@/components/control/v2/ControlActionButtonV2";
import ControlBadgeV2 from "@/components/control/v2/ControlBadgeV2";
import { ControlInputV2, ControlSelectV2 } from "@/components/control/v2/ControlFieldV2";
import { ControlTableCellV2, ControlTableHeadCellV2, ControlTableV2, ControlTableWrapV2 } from "@/components/control/v2/ControlTableV2";
import { controlV2Theme as t } from "@/components/control/v2/controlV2Theme";
import { getPlatformSnapshot, getShopSnapshot, getViewerContext, selectPrimaryShop, type ShopSnapshot } from "@/lib/control/summary";
import { formatDateTime } from "@/lib/ui/dates";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type QueueRow = {
  id: string;
  area: "billing" | "apps" | "devices" | "people" | "platform";
  priority: "high" | "medium" | "low";
  status: string;
  evidence: string;
  reason: string;
  authority: string;
  nextLabel: string;
  nextHref: string;
};

function firstParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : Array.isArray(value) ? value[0] ?? "" : "";
}

function formatMaybeDate(value: string | null) {
  if (!value) return "Not set";
  try {
    return formatDateTime(value);
  } catch {
    return value;
  }
}

function badgeTone(priority: QueueRow["priority"]): "danger" | "warning" | "neutral" {
  if (priority === "high") return "danger";
  if (priority === "medium") return "warning";
  return "neutral";
}

function priorityLabel(priority: QueueRow["priority"]) {
  if (priority === "high") return "High";
  if (priority === "medium") return "Medium";
  return "Low";
}

function buildRows(snapshot: ShopSnapshot, isPlatformAdmin: boolean, platformSnapshot: Awaited<ReturnType<typeof getPlatformSnapshot>> | null): QueueRow[] {
  const employeeAccessGap = Math.max(0, snapshot.counts.employees_active - snapshot.counts.employees_workstation_ready);
  const billingPriority =
    snapshot.access.state === "grace" || snapshot.access.state === "restricted" || snapshot.access.state === "expired" ? "high" :
    snapshot.access.state === "trialing" && snapshot.trial_ends_at ? "medium" :
    "low";
  const appPriority =
    snapshot.access.workstation_mode !== "full" ? "high" :
    snapshot.access.mobile_mode !== "full" || snapshot.access.desktop_mode !== "full" ? "medium" :
    "low";
  const devicePriority =
    snapshot.health.offline_devices > 0 ? "high" :
    snapshot.health.stale_devices > 0 ? "medium" :
    "low";
  const peoplePriority =
    snapshot.counts.employees_total === 0 ? "medium" :
    employeeAccessGap > 0 ? "medium" :
    "low";

  const rows: QueueRow[] = [
    {
      id: "billing",
      area: "billing",
      priority: billingPriority,
      status:
        billingPriority === "high" ? "Review now" :
        billingPriority === "medium" ? "Review soon" :
        "Clear",
      evidence:
        snapshot.access.state === "trialing" && snapshot.trial_ends_at
          ? `Trial ends ${formatMaybeDate(snapshot.trial_ends_at)}.`
          : `Billing state ${snapshot.access.display_status}.`,
      reason: snapshot.access.summary,
      authority: "getShopSnapshot() -> rb_shops + billing/access authority",
      nextLabel: "Open billing",
      nextHref: "/billing-access",
    },
    {
      id: "apps",
      area: "apps",
      priority: appPriority,
      status:
        appPriority === "high" ? "Access blocked" :
        appPriority === "medium" ? "Access reduced" :
        "Clear",
      evidence: `Desktop ${snapshot.access.desktop_mode}, Workstation ${snapshot.access.workstation_mode}, Mobile ${snapshot.access.mobile_mode}.`,
      reason: "App access follows the current shop access decision and should be reviewed before troubleshooting clients.",
      authority: "getShopSnapshot() -> describeShopAccess(getShopEntitlement(...))",
      nextLabel: "Open apps",
      nextHref: "/apps",
    },
    {
      id: "devices",
      area: "devices",
      priority: devicePriority,
      status:
        devicePriority === "high" ? "Offline devices" :
        devicePriority === "medium" ? "Stale devices" :
        "Clear",
      evidence:
        devicePriority === "high"
          ? `${snapshot.health.offline_devices} offline device${snapshot.health.offline_devices === 1 ? "" : "s"}.`
          : devicePriority === "medium"
            ? `${snapshot.health.stale_devices} stale device${snapshot.health.stale_devices === 1 ? "" : "s"}.`
            : `${snapshot.counts.devices_active} active of ${snapshot.counts.devices_total} total devices.`,
      reason: snapshot.health.last_device_activity_at
        ? `Last merged device activity ${formatMaybeDate(snapshot.health.last_device_activity_at)}.`
        : "No recent device activity was recorded for this shop.",
      authority: "getShopSnapshot() -> rb_devices + rb_device_tokens",
      nextLabel: "Review devices",
      nextHref: "/devices",
    },
    {
      id: "people",
      area: "people",
      priority: peoplePriority,
      status:
        snapshot.counts.employees_total === 0 ? "Setup pending" :
        employeeAccessGap > 0 ? "Access review" :
        "Clear",
      evidence:
        snapshot.counts.employees_total === 0
          ? "No employees are recorded yet."
          : `${snapshot.counts.employees_workstation_ready} workstation-ready of ${snapshot.counts.employees_active} active employees.`,
      reason:
        snapshot.counts.employees_total === 0
          ? "People setup must exist before workstation or mobile rollout can be trusted."
          : employeeAccessGap > 0
            ? `${employeeAccessGap} active employee${employeeAccessGap === 1 ? "" : "s"} still need workstation access review.`
            : "Employee readiness does not currently show an access gap.",
      authority: "getShopSnapshot() -> employees",
      nextLabel: "Open people",
      nextHref: "/people",
    },
  ];

  if (isPlatformAdmin && platformSnapshot) {
    rows.push({
      id: "platform",
      area: "platform",
      priority: "low",
      status: "Scope shown",
      evidence: `${platformSnapshot.manageableShopCount} manageable shops, ${platformSnapshot.auditCount} audit rows in current platform snapshot.`,
      reason: "Platform totals are secondary context for a platform-admin session and do not replace the selected-shop queue above.",
      authority: "getPlatformSnapshot() -> rb_shops + rb_devices + employees + rb_audit_log",
      nextLabel: "Open status",
      nextHref: "/status",
    });
  }

  return rows;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const requestedShopId = firstParam(params.shop);
  const areaFilter = firstParam(params.area).trim().toLowerCase() || "all";
  const priorityFilter = firstParam(params.priority).trim().toLowerCase() || "all";
  const query = firstParam(params.q).trim().toLowerCase();

  const context = await getViewerContext();
  const primaryShop = selectPrimaryShop(context.shops, requestedShopId);
  const shopSnapshot = primaryShop ? await getShopSnapshot(primaryShop) : null;
  const platformSnapshot = context.isPlatformAdmin ? await getPlatformSnapshot(context) : null;

  if (!primaryShop || !shopSnapshot) {
    return (
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ color: t.color.textQuiet, ...t.type.label }}>Dashboard</div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>Operations queue</h1>
          <div style={{ fontSize: 13, color: t.color.textQuiet }}>
            The operations queue stays tied to an authorized shop. No shop means there is no shop-scoped operator queue to review yet.
          </div>
        </div>
        <ControlTableWrapV2>
          <ControlTableV2 minWidth={760}>
            <thead>
              <tr>
                <ControlTableHeadCellV2>State</ControlTableHeadCellV2>
                <ControlTableHeadCellV2>Authority</ControlTableHeadCellV2>
                <ControlTableHeadCellV2>Next</ControlTableHeadCellV2>
              </tr>
            </thead>
            <tbody>
              <tr>
                <ControlTableCellV2>No shop is available for operations review.</ControlTableCellV2>
                <ControlTableCellV2>rb_shops and rb_shop_members scope</ControlTableCellV2>
                <ControlTableCellV2><ControlActionLinkV2 href="/shops" tone="primary">Open shops</ControlActionLinkV2></ControlTableCellV2>
              </tr>
            </tbody>
          </ControlTableV2>
        </ControlTableWrapV2>
      </div>
    );
  }

  const rows = buildRows(shopSnapshot, context.isPlatformAdmin, platformSnapshot)
    .filter((row) => (areaFilter === "all" ? true : row.area === areaFilter))
    .filter((row) => (priorityFilter === "all" ? true : row.priority === priorityFilter))
    .filter((row) => {
      if (!query) return true;
      return [row.area, row.status, row.evidence, row.reason, row.authority]
        .some((value) => value.toLowerCase().includes(query));
    });

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ color: t.color.textQuiet, ...t.type.label }}>Dashboard</div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>Operations queue</h1>
          <div style={{ fontSize: 13, color: t.color.textQuiet }}>
            Selected-shop operator queue for what needs review first across billing, app access, devices, and people. Platform totals remain secondary context only.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <ControlActionLinkV2 href="/people">Open people</ControlActionLinkV2>
          <ControlActionLinkV2 href="/devices" tone="primary">Open devices</ControlActionLinkV2>
        </div>
      </div>

      <form method="get" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <ControlSelectV2 name="shop" defaultValue={primaryShop.id} style={{ minWidth: 220 }}>
          {context.shops.map((shop) => (
            <option key={shop.id} value={shop.id}>{shop.name}</option>
          ))}
        </ControlSelectV2>
        <ControlSelectV2 name="area" defaultValue={areaFilter} style={{ minWidth: 160 }}>
          <option value="all">All areas</option>
          <option value="billing">Billing</option>
          <option value="apps">Apps</option>
          <option value="devices">Devices</option>
          <option value="people">People</option>
          {context.isPlatformAdmin ? <option value="platform">Platform</option> : null}
        </ControlSelectV2>
        <ControlSelectV2 name="priority" defaultValue={priorityFilter} style={{ minWidth: 160 }}>
          <option value="all">All priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </ControlSelectV2>
        <ControlInputV2 name="q" defaultValue={firstParam(params.q)} placeholder="Search evidence or reason" style={{ minWidth: 220 }} />
        <ControlActionButtonV2 type="submit" tone="primary">
          Apply
        </ControlActionButtonV2>
        <ControlActionLinkV2 href={`/dashboard?shop=${encodeURIComponent(primaryShop.id)}`}>Clear</ControlActionLinkV2>
      </form>

      <div style={{ fontSize: 12, color: t.color.textQuiet }}>
        {rows.length} queue row{rows.length === 1 ? "" : "s"} shown for {shopSnapshot.name}. Shop truth comes from current server-side shop snapshot authority; this page does not claim live client handshakes or cross-shop aggregate state.
      </div>

      <ControlTableWrapV2>
        <ControlTableV2 minWidth={1120}>
          <thead>
            <tr>
              <ControlTableHeadCellV2>Area</ControlTableHeadCellV2>
              <ControlTableHeadCellV2>Priority</ControlTableHeadCellV2>
              <ControlTableHeadCellV2>Status</ControlTableHeadCellV2>
              <ControlTableHeadCellV2>Evidence</ControlTableHeadCellV2>
              <ControlTableHeadCellV2>Reason</ControlTableHeadCellV2>
              <ControlTableHeadCellV2>Authority</ControlTableHeadCellV2>
              <ControlTableHeadCellV2 align="right">Next</ControlTableHeadCellV2>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 16, color: t.color.textMuted }}>
                  No queue rows matched the current filters.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <ControlTableCellV2>
                    <div style={{ textTransform: "capitalize", fontWeight: 700, color: t.color.text }}>{row.area}</div>
                  </ControlTableCellV2>
                  <ControlTableCellV2>
                    <ControlBadgeV2 label={priorityLabel(row.priority)} tone={badgeTone(row.priority)} />
                  </ControlTableCellV2>
                  <ControlTableCellV2>{row.status}</ControlTableCellV2>
                  <ControlTableCellV2>{row.evidence}</ControlTableCellV2>
                  <ControlTableCellV2>{row.reason}</ControlTableCellV2>
                  <ControlTableCellV2>{row.authority}</ControlTableCellV2>
                  <ControlTableCellV2 align="right">
                    <ControlActionLinkV2 href={row.nextHref}>{row.nextLabel}</ControlActionLinkV2>
                  </ControlTableCellV2>
                </tr>
              ))
            )}
          </tbody>
        </ControlTableV2>
      </ControlTableWrapV2>
    </div>
  );
}
