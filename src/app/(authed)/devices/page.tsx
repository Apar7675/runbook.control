import React from "react";
import { ControlActionLink } from "@/components/control/ControlActionButton";
import ControlEmptyState from "@/components/control/ControlEmptyState";
import ControlMetricCard from "@/components/control/ControlMetricCard";
import ControlPageHeader from "@/components/control/ControlPageHeader";
import ControlPanel from "@/components/control/ControlPanel";
import ControlStatusChip, { type ControlStatusTone } from "@/components/control/ControlStatusChip";
import { ControlTable, ControlTableCell, ControlTableHeadCell, ControlTableWrap } from "@/components/control/ControlTable";
import { loadDeviceViewRows, type DeviceViewRow } from "@/lib/control/deviceViews";
import { formatDateTime } from "@/lib/ui/dates";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : Array.isArray(value) ? value[0] ?? "" : "";
}

function formatMaybeDate(value: string | null | undefined) {
  if (!value) return "Not surfaced";
  try {
    return formatDateTime(value);
  } catch {
    return value;
  }
}

function toneFromUpdateStatus(row: DeviceViewRow): ControlStatusTone {
  if (row.update_status === "required") return "danger";
  if (row.update_status === "warning") return "warning";
  if (row.update_status === "current") return "success";
  return "neutral";
}

function toneFromDeviceStatus(status: string | null | undefined): ControlStatusTone {
  const value = String(status ?? "").trim().toLowerCase();
  if (value === "active") return "success";
  if (value === "disabled" || value === "blocked") return "danger";
  return "neutral";
}

function toneFromCapability(row: DeviceViewRow): ControlStatusTone {
  const value = String(row.capability?.requirements_status ?? "").trim().toLowerCase();
  if (value === "fail" || value === "failed") return "danger";
  if (value === "warning") return "warning";
  if (value === "pass" || value === "passed") return "success";
  return row.capability ? "info" : "neutral";
}

function capabilityLabel(row: DeviceViewRow) {
  if (!row.capability) return "Not surfaced";
  if (row.capability_warning) return row.capability_warning;
  const status = String(row.capability.requirements_status ?? "").trim();
  return status ? status.replaceAll("_", " ") : "Reported";
}

export default async function DevicesPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = (await searchParams) ?? {};
  const typeFilter = firstParam(params.type).trim().toLowerCase() || "all";
  const statusFilter = firstParam(params.status).trim().toLowerCase() || "all";
  const shopFilter = firstParam(params.shop).trim();
  const accessFilter = firstParam(params.access).trim().toLowerCase() || "all";

  const { context, rows } = await loadDeviceViewRows();

  if (!context.isPlatformAdmin) {
    return (
      <div style={{ display: "grid", gap: 18 }}>
        <ControlPageHeader
          eyebrow="Devices"
          title="Devices"
          description="This area stays restricted to platform-admin sessions because it exposes cross-shop device enrollment and token authority."
          actions={<ControlActionLink href="/dashboard">Return to command center</ControlActionLink>}
        />
        <ControlPanel>
          <ControlEmptyState
            title="Platform admin access required"
            description="Open Devices with a platform-admin AAL2 session to review enrolled Desktop and Workstation devices."
          />
        </ControlPanel>
      </div>
    );
  }

  const filteredRows = rows.filter((row) => {
    if (typeFilter !== "all" && String(row.device_type ?? "").trim().toLowerCase() !== typeFilter) return false;
    if (statusFilter !== "all" && String(row.status ?? "").trim().toLowerCase() !== statusFilter) return false;
    if (shopFilter && String(row.shop_id ?? "") !== shopFilter) return false;
    if (accessFilter !== "all" && row.access_mode.replaceAll("_", " ").toLowerCase() !== accessFilter) return false;
    return true;
  });

  const totalDevices = rows.length;
  const onlineDevices = rows.filter((row) => Boolean(row.merged_last_seen_at)).length;
  const blockedDevices = rows.filter((row) => String(row.status ?? "").trim().toLowerCase() !== "active" || row.access_mode.toLowerCase() === "blocked").length;
  const updateAttention = rows.filter((row) => row.update_status === "required" || row.update_status === "warning").length;
  const capabilityWarnings = rows.filter((row) => Boolean(row.capability_warning)).length;

  const uniqueShops = [...new Map(rows.filter((row) => row.shop_id).map((row) => [row.shop_id as string, row.shop_name ?? row.shop_id as string])).entries()];

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <ControlPageHeader
        eyebrow="Devices"
        title="Devices"
        description="Cloud authority view of enrolled Desktop and Workstation devices, token activity, update posture, and capability telemetry."
        actions={<ControlActionLink href="/workstations">Open workstations</ControlActionLink>}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
        <ControlMetricCard label="Total Devices" value={String(totalDevices)} meta="All enrolled Desktop and Workstation device rows in Control." tone="neutral" />
        <ControlMetricCard label="Online / Recently Seen" value={String(onlineDevices)} meta="Merged from device last check-in and active token heartbeat." tone={onlineDevices > 0 ? "success" : "warning"} />
        <ControlMetricCard label="Disabled / Blocked" value={String(blockedDevices)} meta="Includes disabled records and devices blocked by current access mode." tone={blockedDevices > 0 ? "danger" : "success"} />
        <ControlMetricCard label="Update Attention" value={String(updateAttention)} meta={updateAttention > 0 ? "Some devices are below minimum, pinned-mismatched, or missing version data." : "No update warnings are currently inferred from policy."} tone={updateAttention > 0 ? "warning" : "success"} />
        <ControlMetricCard label="Capability Warnings" value={String(capabilityWarnings)} meta={rows.some((row) => row.capability) ? "Warnings are derived from the latest capability snapshot per device." : "Capability snapshots are not surfaced in the current data set."} tone={capabilityWarnings > 0 ? "warning" : rows.some((row) => row.capability) ? "success" : "neutral"} />
      </div>

      <ControlPanel
        title="Device Directory"
        description="Table-first device authority surface with real enrollment, heartbeat, version, and policy data."
      >
        <form method="get" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select
            name="type"
            defaultValue={typeFilter}
            style={{ minHeight: 38, minWidth: 150, borderRadius: 12, border: "1px solid rgba(148, 163, 184, 0.16)", background: "rgba(18, 27, 40, 0.95)", color: "#F8FAFC", padding: "0 12px" }}
          >
            <option value="all">All types</option>
            <option value="desktop">Desktop</option>
            <option value="workstation">Workstation</option>
          </select>
          <select
            name="status"
            defaultValue={statusFilter}
            style={{ minHeight: 38, minWidth: 150, borderRadius: 12, border: "1px solid rgba(148, 163, 184, 0.16)", background: "rgba(18, 27, 40, 0.95)", color: "#F8FAFC", padding: "0 12px" }}
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </select>
          <select
            name="shop"
            defaultValue={shopFilter}
            style={{ minHeight: 38, minWidth: 220, borderRadius: 12, border: "1px solid rgba(148, 163, 184, 0.16)", background: "rgba(18, 27, 40, 0.95)", color: "#F8FAFC", padding: "0 12px" }}
          >
            <option value="">All shops</option>
            {uniqueShops.map(([shopId, shopName]) => (
              <option key={shopId} value={shopId}>{shopName}</option>
            ))}
          </select>
          <select
            name="access"
            defaultValue={accessFilter}
            style={{ minHeight: 38, minWidth: 180, borderRadius: 12, border: "1px solid rgba(148, 163, 184, 0.16)", background: "rgba(18, 27, 40, 0.95)", color: "#F8FAFC", padding: "0 12px" }}
          >
            <option value="all">All access modes</option>
            <option value="full">Full</option>
            <option value="read only">Read only</option>
            <option value="blocked">Blocked</option>
          </select>
          <button
            type="submit"
            style={{ minHeight: 38, padding: "0 14px", borderRadius: 12, border: "1px solid rgba(37, 99, 235, 0.36)", background: "rgba(37, 99, 235, 0.18)", color: "#F8FAFC", fontWeight: 700, cursor: "pointer" }}
          >
            Apply
          </button>
          <ControlActionLink href="/devices">Clear</ControlActionLink>
        </form>

        {filteredRows.length === 0 ? (
          <ControlEmptyState
            title="No devices matched the current filters"
            description="Try a wider filter combination or wait for new enrolled devices to report back into Control."
          />
        ) : (
          <ControlTableWrap>
            <ControlTable minWidth={1380}>
              <thead>
                <tr>
                  <ControlTableHeadCell>Device Name</ControlTableHeadCell>
                  <ControlTableHeadCell>Type</ControlTableHeadCell>
                  <ControlTableHeadCell>Shop</ControlTableHeadCell>
                  <ControlTableHeadCell>Status</ControlTableHeadCell>
                  <ControlTableHeadCell>Last Check-In</ControlTableHeadCell>
                  <ControlTableHeadCell>Version</ControlTableHeadCell>
                  <ControlTableHeadCell>Access Mode</ControlTableHeadCell>
                  <ControlTableHeadCell>Capability Warning</ControlTableHeadCell>
                  <ControlTableHeadCell>Update Policy</ControlTableHeadCell>
                  <ControlTableHeadCell align="right">Action</ControlTableHeadCell>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id}>
                    <ControlTableCell>
                      <div style={{ display: "grid", gap: 4 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "#F8FAFC" }}>{row.name}</div>
                        <div style={{ fontSize: 12, color: "#64748B" }}>{row.id}</div>
                      </div>
                    </ControlTableCell>
                    <ControlTableCell>{row.device_type ? row.device_type.replaceAll("_", " ") : "Not surfaced"}</ControlTableCell>
                    <ControlTableCell>{row.shop_name ?? row.shop_id ?? "Unassigned"}</ControlTableCell>
                    <ControlTableCell>
                      <div style={{ display: "grid", gap: 6 }}>
                        <ControlStatusChip label={row.status ? row.status.replaceAll("_", " ") : "Unknown"} tone={toneFromDeviceStatus(row.status)} />
                        <div style={{ fontSize: 12, color: "#64748B" }}>{row.active_token_count} active token{row.active_token_count === 1 ? "" : "s"}</div>
                      </div>
                    </ControlTableCell>
                    <ControlTableCell>{formatMaybeDate(row.merged_last_seen_at)}</ControlTableCell>
                    <ControlTableCell>{row.reported_version ?? "Not surfaced"}</ControlTableCell>
                    <ControlTableCell>
                      <div style={{ display: "grid", gap: 6 }}>
                        <ControlStatusChip label={row.access_mode} tone={row.access_mode.toLowerCase() === "full" ? "success" : row.access_mode.toLowerCase() === "blocked" ? "danger" : "warning"} />
                        <div style={{ fontSize: 12, color: "#64748B", lineHeight: 1.5 }}>{row.access_reason}</div>
                      </div>
                    </ControlTableCell>
                    <ControlTableCell>
                      <ControlStatusChip label={capabilityLabel(row)} tone={toneFromCapability(row)} />
                    </ControlTableCell>
                    <ControlTableCell>
                      <div style={{ display: "grid", gap: 6 }}>
                        <ControlStatusChip label={row.update_label} tone={toneFromUpdateStatus(row)} />
                        <div style={{ fontSize: 12, color: "#64748B", lineHeight: 1.5 }}>
                          {row.update_policy
                            ? `Channel ${row.update_policy.channel ?? "stable"}${row.update_policy.min_version ? ` | Min ${row.update_policy.min_version}` : ""}${row.update_policy.pinned_version ? ` | Pin ${row.update_policy.pinned_version}` : ""}`
                            : "Not surfaced"}
                        </div>
                      </div>
                    </ControlTableCell>
                    <ControlTableCell align="right">
                      <ControlActionLink href={`/devices/${row.id}`} tone="secondary">Open</ControlActionLink>
                    </ControlTableCell>
                  </tr>
                ))}
              </tbody>
            </ControlTable>
          </ControlTableWrap>
        )}
      </ControlPanel>
    </div>
  );
}
