import React from "react";
import ControlMetricStripV2 from "@/components/control/v2/ControlMetricStripV2";
import ControlPanelV2 from "@/components/control/v2/ControlPanelV2";
import ControlBadgeV2, { toneFromStatusV2 } from "@/components/control/v2/ControlBadgeV2";
import { controlV2Theme as t } from "@/components/control/v2/controlV2Theme";
import { formatDateTime } from "@/lib/ui/dates";
import type { ShopSnapshot } from "@/lib/control/summary";
import ShopDeleteControlV2 from "@/components/shops/v2/ShopDeleteControlV2";

function detailRow(label: string, value: React.ReactNode) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "140px minmax(0,1fr)", gap: 12, padding: "7px 0", borderTop: `1px solid ${t.color.border}` }}>
      <div style={{ color: t.color.textQuiet, ...t.type.label }}>{label}</div>
      <div style={{ fontSize: 12.5, color: t.color.textMuted, fontWeight: 700, lineHeight: 1.45 }}>{value}</div>
    </div>
  );
}

export default function OverviewTabV2({
  snapshot,
  isPlatformAdmin,
}: {
  snapshot: ShopSnapshot;
  isPlatformAdmin: boolean;
}) {
  const attention = snapshot.health.offline_devices + snapshot.health.stale_devices;
  const deviceHealth = attention > 0 ? "Warning" : "OK";

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <ControlMetricStripV2
        items={[
          { label: "Access", value: snapshot.access.display_status, meta: <ControlBadgeV2 label={snapshot.access.display_status} tone={toneFromStatusV2(snapshot.access.display_status)} /> },
          { label: "Users", value: String(snapshot.counts.employees_active), meta: `${snapshot.counts.employees_total} total` },
          { label: "Devices", value: String(snapshot.counts.devices_active), meta: <ControlBadgeV2 label={deviceHealth} tone={toneFromStatusV2(deviceHealth)} /> },
          { label: "Attention", value: String(attention), meta: attention > 0 ? "Needs follow-up" : "Clear" },
        ]}
      />

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 14 }}>
        <ControlPanelV2 title="Operational summary">
          {detailRow("Desktop", snapshot.access.desktop_mode === "full" ? "Allowed" : "Read-only")}
          {detailRow("Workstation", snapshot.access.workstation_mode === "full" ? "Allowed" : "Blocked")}
          {detailRow("Mobile", snapshot.access.mobile_mode === "full" ? "Allowed" : snapshot.access.mobile_mode === "queue_only" ? "Queue-only" : "Blocked")}
          {detailRow("Last device activity", snapshot.health.last_device_activity_at ? formatDateTime(snapshot.health.last_device_activity_at) : "No recent device activity")}
          {detailRow("Audit events", String(snapshot.health.recent_audit_events))}
        </ControlPanelV2>

        <ControlPanelV2 title="Billing and access dates">
          {detailRow("Billing status", snapshot.billing_status ? snapshot.billing_status.replace(/_/g, " ") : "Unknown")}
          {detailRow("Trial end", snapshot.trial_ends_at ? formatDateTime(snapshot.trial_ends_at) : "Not set")}
          {detailRow("Billing period end", snapshot.billing_current_period_end ? formatDateTime(snapshot.billing_current_period_end) : "Not set")}
          {detailRow("Grace end", snapshot.grace_ends_at ? formatDateTime(snapshot.grace_ends_at) : "Not set")}
          {detailRow("Access summary", snapshot.access.summary)}
        </ControlPanelV2>
      </div>

      {isPlatformAdmin ? <ShopDeleteControlV2 shopId={snapshot.id} shopName={snapshot.name} /> : null}
    </div>
  );
}
