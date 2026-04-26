import React from "react";
import { ControlActionButtonV2, ControlActionLinkV2 } from "@/components/control/v2/ControlActionButtonV2";
import ControlBadgeV2 from "@/components/control/v2/ControlBadgeV2";
import { ControlSelectV2 } from "@/components/control/v2/ControlFieldV2";
import { ControlTableCellV2, ControlTableHeadCellV2, ControlTableV2, ControlTableWrapV2 } from "@/components/control/v2/ControlTableV2";
import { controlV2Theme as t } from "@/components/control/v2/controlV2Theme";
import { getShopSnapshot, getViewerContext, selectPrimaryShop, type ShopSnapshot } from "@/lib/control/summary";

export const dynamic = "force-dynamic";

type AppRow = {
  id: string;
  app: string;
  access: string;
  severity: "success" | "warning" | "danger" | "neutral";
  evidence: string;
  authority: string;
  reason: string;
  actionLabel: string;
  actionHref: string;
};

function firstParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : Array.isArray(value) ? value[0] ?? "" : "";
}

function buildRows(snapshot: ShopSnapshot, isPlatformAdmin: boolean): AppRow[] {
  const desktopAccess =
    snapshot.access.desktop_mode === "full" ? "Allowed" :
    snapshot.access.desktop_mode === "read_only" ? "Read-only" :
    "Blocked";
  const workstationAccess = snapshot.access.workstation_mode === "full" ? "Allowed" : "Blocked";
  const mobileAccess =
    snapshot.access.mobile_mode === "full" ? "Allowed" :
    snapshot.access.mobile_mode === "queue_only" ? "Queue-only" :
    "Blocked";
  const controlAccess = isPlatformAdmin ? "Admin session" : "Member session";

  return [
    {
      id: "desktop",
      app: "Desktop",
      access: desktopAccess,
      severity: snapshot.access.desktop_mode === "full" ? "success" : snapshot.access.desktop_mode === "read_only" ? "warning" : "danger",
      evidence: `${snapshot.counts.desktops_active} active of ${snapshot.counts.desktops_total} registered desktop device${snapshot.counts.desktops_total === 1 ? "" : "s"}.`,
      authority: "getShopSnapshot() -> rb_devices + billing/access authority",
      reason: snapshot.access.summary,
      actionLabel: "Review devices",
      actionHref: "/devices",
    },
    {
      id: "workstation",
      app: "Workstation",
      access: workstationAccess,
      severity: snapshot.access.workstation_mode === "full" ? "success" : "danger",
      evidence: `${snapshot.counts.employees_workstation_ready} active employee${snapshot.counts.employees_workstation_ready === 1 ? "" : "s"} marked ready for workstation access.`,
      authority: "getShopSnapshot() -> employees + billing/access authority",
      reason: snapshot.access.workstation_mode === "full"
        ? "Workstation sign-in is allowed by the current shop access decision."
        : "Workstation sign-in is blocked by the current shop access decision.",
      actionLabel: "Review people",
      actionHref: "/people",
    },
    {
      id: "mobile",
      app: "Mobile",
      access: mobileAccess,
      severity: snapshot.access.mobile_mode === "full" ? "success" : snapshot.access.mobile_mode === "queue_only" ? "warning" : "danger",
      evidence: `${snapshot.counts.employees_mobile_ready} active employee${snapshot.counts.employees_mobile_ready === 1 ? "" : "s"} marked eligible for mobile access.`,
      authority: "getShopSnapshot() -> employees + billing/access authority",
      reason: snapshot.access.mobile_mode === "full"
        ? "Mobile is allowed by the current shop access decision."
        : snapshot.access.mobile_mode === "queue_only"
          ? "Mobile is limited to queued punches by the current shop access decision."
          : "Mobile is blocked by the current shop access decision.",
      actionLabel: "Review billing",
      actionHref: "/billing-access",
    },
    {
      id: "control",
      app: "Control",
      access: controlAccess,
      severity: "neutral",
      evidence: isPlatformAdmin
        ? "This page is available because the current session passed platform-admin access checks."
        : `This page is available because the current signed-in member can access ${snapshot.name}.`,
      authority: isPlatformAdmin ? "getViewerContext() -> rb_control_admins / platform-admin policy" : "getViewerContext() -> rb_shop_members",
      reason: "Control availability here reflects the signed-in session and authorized shop scope, not downstream app health.",
      actionLabel: "Open settings",
      actionHref: "/settings",
    },
  ];
}

export default async function AppsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const requestedShopId = firstParam(params.shop);
  const appFilter = firstParam(params.app).trim().toLowerCase() || "all";
  const accessFilter = firstParam(params.access).trim().toLowerCase() || "all";
  const context = await getViewerContext();
  const primaryShop = selectPrimaryShop(context.shops, requestedShopId);
  const snapshot = primaryShop ? await getShopSnapshot(primaryShop) : null;

  if (!primaryShop || !snapshot) {
    return (
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ color: t.color.textQuiet, ...t.type.label }}>Apps</div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>App access matrix</h1>
          <div style={{ fontSize: 13, color: t.color.textQuiet }}>
            App access stays tied to real shop, device, employee, and billing authority. No shop means there is no app-access matrix to review yet.
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
                <ControlTableCellV2>No shop is available for app access review.</ControlTableCellV2>
                <ControlTableCellV2>rb_shops and rb_shop_members scope</ControlTableCellV2>
                <ControlTableCellV2><ControlActionLinkV2 href="/shops" tone="primary">Open shops</ControlActionLinkV2></ControlTableCellV2>
              </tr>
            </tbody>
          </ControlTableV2>
        </ControlTableWrapV2>
      </div>
    );
  }

  const rows = buildRows(snapshot, context.isPlatformAdmin)
    .filter((row) => (appFilter === "all" ? true : row.id === appFilter))
    .filter((row) => {
      if (accessFilter === "all") return true;
      if (accessFilter === "attention") return row.severity === "warning" || row.severity === "danger";
      return row.access.toLowerCase() === accessFilter;
    });

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ color: t.color.textQuiet, ...t.type.label }}>Apps</div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>App access matrix</h1>
          <div style={{ fontSize: 13, color: t.color.textQuiet }}>
            Operator table for app access by shop. Each row stays tied to current shop access authority, real device or employee counts, and the signed-in session scope.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <ControlActionLinkV2 href="/devices">Review devices</ControlActionLinkV2>
          <ControlActionLinkV2 href="/billing-access" tone="primary">Review billing impact</ControlActionLinkV2>
        </div>
      </div>

      <form method="get" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <ControlSelectV2 name="shop" defaultValue={primaryShop.id} style={{ minWidth: 220 }}>
          {context.shops.map((shop) => (
            <option key={shop.id} value={shop.id}>{shop.name}</option>
          ))}
        </ControlSelectV2>
        <ControlSelectV2 name="app" defaultValue={appFilter} style={{ minWidth: 160 }}>
          <option value="all">All apps</option>
          <option value="desktop">Desktop</option>
          <option value="workstation">Workstation</option>
          <option value="mobile">Mobile</option>
          <option value="control">Control</option>
        </ControlSelectV2>
        <ControlSelectV2 name="access" defaultValue={accessFilter} style={{ minWidth: 180 }}>
          <option value="all">All access states</option>
          <option value="attention">Needs attention</option>
          <option value="allowed">Allowed</option>
          <option value="read-only">Read-only</option>
          <option value="queue-only">Queue-only</option>
          <option value="blocked">Blocked</option>
          <option value="admin session">Admin session</option>
          <option value="member session">Member session</option>
        </ControlSelectV2>
        <ControlActionButtonV2 type="submit" tone="primary">
          Apply
        </ControlActionButtonV2>
        <ControlActionLinkV2 href={`/apps?shop=${encodeURIComponent(primaryShop.id)}`}>Clear</ControlActionLinkV2>
      </form>

      <div style={{ fontSize: 12, color: t.color.textQuiet }}>
        {rows.length} app row{rows.length === 1 ? "" : "s"} shown for {snapshot.name}. Access truth comes from the current shop access decision, not from optimistic client state.
      </div>

      <ControlTableWrapV2>
        <ControlTableV2 minWidth={1120}>
          <thead>
            <tr>
              <ControlTableHeadCellV2>App</ControlTableHeadCellV2>
              <ControlTableHeadCellV2>Access</ControlTableHeadCellV2>
              <ControlTableHeadCellV2>Evidence</ControlTableHeadCellV2>
              <ControlTableHeadCellV2>Authority</ControlTableHeadCellV2>
              <ControlTableHeadCellV2>Reason</ControlTableHeadCellV2>
              <ControlTableHeadCellV2 align="right">Next</ControlTableHeadCellV2>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 16, color: t.color.textMuted }}>
                  No app rows matched the current filters.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <ControlTableCellV2>
                    <div style={{ fontWeight: 700, color: t.color.text }}>{row.app}</div>
                  </ControlTableCellV2>
                  <ControlTableCellV2>
                    <div style={{ display: "grid", gap: 4 }}>
                      <div><ControlBadgeV2 label={row.access} tone={row.severity} /></div>
                    </div>
                  </ControlTableCellV2>
                  <ControlTableCellV2>{row.evidence}</ControlTableCellV2>
                  <ControlTableCellV2>{row.authority}</ControlTableCellV2>
                  <ControlTableCellV2>{row.reason}</ControlTableCellV2>
                  <ControlTableCellV2 align="right">
                    <ControlActionLinkV2 href={row.actionHref}>{row.actionLabel}</ControlActionLinkV2>
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
