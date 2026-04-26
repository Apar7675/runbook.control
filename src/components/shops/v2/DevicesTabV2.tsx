import React from "react";
import ControlBadgeV2, { toneFromStatusV2 } from "@/components/control/v2/ControlBadgeV2";
import { controlV2Theme as t } from "@/components/control/v2/controlV2Theme";
import { ControlTableV2, ControlTableCellV2, ControlTableHeadCellV2, ControlTableWrapV2 } from "@/components/control/v2/ControlTableV2";
import { formatDateTime } from "@/lib/ui/dates";
import type { ShopSnapshot } from "@/lib/control/summary";

export type ShopDeviceRowV2 = {
  id: string;
  name: string | null;
  status: string | null;
  device_type: string | null;
  created_at: string | null;
  last_seen_at: string | null;
};

function classifyDevice(lastSeenAt: string | null) {
  if (!lastSeenAt) return "offline";
  const ms = Date.parse(lastSeenAt);
  if (!Number.isFinite(ms)) return "offline";
  const age = Date.now() - ms;
  const day = 24 * 60 * 60 * 1000;
  if (age > 7 * day) return "offline";
  if (age > day) return "stale";
  return "healthy";
}

export default function DevicesTabV2({
  snapshot,
  devices,
}: {
  snapshot: ShopSnapshot;
  devices: ShopDeviceRowV2[];
}) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}><span style={{ fontSize: 20, fontWeight: 800 }}>{snapshot.counts.devices_total}</span><span style={{ color: t.color.textQuiet, ...t.type.label }}>Total</span></div>
          <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}><span style={{ fontSize: 20, fontWeight: 800 }}>{snapshot.counts.devices_active}</span><span style={{ color: t.color.textQuiet, ...t.type.label }}>Active</span></div>
          <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}><span style={{ fontSize: 20, fontWeight: 800 }}>{snapshot.health.stale_devices}</span><span style={{ color: t.color.textQuiet, ...t.type.label }}>Stale</span></div>
          <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}><span style={{ fontSize: 20, fontWeight: 800 }}>{snapshot.health.offline_devices}</span><span style={{ color: t.color.textQuiet, ...t.type.label }}>Offline</span></div>
        </div>
      </div>

      <ControlTableWrapV2>
        <ControlTableV2>
          <thead>
            <tr>
              {["Device", "Type", "Status", "Health", "Last seen", "Created"].map((heading) => (
                <ControlTableHeadCellV2 key={heading}>{heading}</ControlTableHeadCellV2>
              ))}
            </tr>
          </thead>
          <tbody>
            {devices.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 14, color: t.color.textMuted }}>No devices are registered for this shop yet.</td>
              </tr>
            ) : (
              devices.map((device) => {
                const health = classifyDevice(device.last_seen_at);
                const healthLabel = health === "healthy" ? "OK" : health === "stale" ? "Warning" : "Action Needed";
                return (
                  <tr key={device.id}>
                    <ControlTableCellV2><span style={{ fontWeight: 700, color: t.color.text }}>{device.name ?? "Unnamed device"}</span></ControlTableCellV2>
                    <ControlTableCellV2>{device.device_type ?? "Unknown"}</ControlTableCellV2>
                    <ControlTableCellV2><ControlBadgeV2 label={(device.status ?? "unknown").replace(/_/g, " ")} tone={toneFromStatusV2(device.status ?? "Warning")} /></ControlTableCellV2>
                    <ControlTableCellV2><ControlBadgeV2 label={healthLabel} tone={toneFromStatusV2(healthLabel)} /></ControlTableCellV2>
                    <ControlTableCellV2>{device.last_seen_at ? formatDateTime(device.last_seen_at) : "Never"}</ControlTableCellV2>
                    <ControlTableCellV2>{device.created_at ? formatDateTime(device.created_at) : "Unknown"}</ControlTableCellV2>
                  </tr>
                );
              })
            )}
          </tbody>
        </ControlTableV2>
      </ControlTableWrapV2>
    </div>
  );
}
