import { CompanyForm } from "@/components/control/CompanyScope";
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
  const shopFilter = firstParam(params.company).trim() || firstParam(params.shop).trim();
  const accessFilter = firstParam(params.access).trim().toLowerCase() || "all";
  const queryFilter = firstParam(params.q).trim();

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
    if (queryFilter && !row.name.toLowerCase().includes(queryFilter.toLowerCase())) return false;
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
    <div className="control-devices" style={{ display: "grid", gap: 12 }}>
      <ControlPageHeader
        eyebrow="Devices"
        title="Devices"
        description="Review each enrolled device, its access and last reported activity."
        actions={<><ControlActionLink href="/workstations">Open workstations</ControlActionLink><ControlActionLink href={`/devices?${new URLSearchParams({ type: typeFilter, status: statusFilter, shop: shopFilter, access: accessFilter, q: queryFilter })}`}>Refresh</ControlActionLink></>}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))", gap: 12 }}>
        <ControlMetricCard label="Total Devices" value={String(totalDevices)} meta="Latest 500 enrolled device rows for the selected company." tone="neutral" />
        <ControlMetricCard label="Check-ins recorded" value={String(onlineDevices)} meta="Latest device report or active token heartbeat; not a live connection." tone={onlineDevices > 0 ? "success" : "warning"} />
        <ControlMetricCard label="Disabled / Blocked" value={String(blockedDevices)} meta="Includes disabled records and devices blocked by current access mode." tone={blockedDevices > 0 ? "danger" : "success"} />
        <ControlMetricCard label="Update Attention" value={String(updateAttention)} meta={updateAttention > 0 ? "Some devices are below minimum, pinned-mismatched, or missing version data." : "No update warnings are currently inferred from policy."} tone={updateAttention > 0 ? "warning" : "success"} />
        <ControlMetricCard label="Capability Warnings" value={String(capabilityWarnings)} meta={rows.some((row) => row.capability) ? "Warnings are derived from the latest capability snapshot per device." : "Capability snapshots are not surfaced in the current data set."} tone={capabilityWarnings > 0 ? "warning" : rows.some((row) => row.capability) ? "success" : "neutral"} />
      </div>

        <CompanyForm className="control-device-filters" method="get" aria-label="Filter devices" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", padding: 8, background: "#DFECFD", borderRadius: 12, border: "1.25px solid #5E7DA5" }}>
          <input name="q" type="search" aria-label="Find a device" placeholder="Find a device…" defaultValue={queryFilter} style={{ flex: "1 1 180px", minWidth: 0, minHeight: 34, borderRadius: 7, border: "1.25px solid #5E7DA5", color: "#12234A", background: "#FFFFFF", padding: "0 12px", font: "inherit", fontSize: 14 }} />
          <select
            name="type"
            aria-label="Device type"
            defaultValue={typeFilter}
            style={{ minHeight: 34, minWidth: 130, borderRadius: 7, border: "1.25px solid #5E7DA5", background: "#FFFFFF", color: "#12234A", padding: "0 12px" }}
          >
            <option value="all">All types</option>
            <option value="desktop">Desktop</option>
            <option value="workstation">Workstation</option>
          </select>
          <select
            name="status"
            aria-label="Device status"
            defaultValue={statusFilter}
            style={{ minHeight: 34, minWidth: 130, borderRadius: 7, border: "1.25px solid #5E7DA5", background: "#FFFFFF", color: "#12234A", padding: "0 12px" }}
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </select>
          <select
            name="shop"
            aria-label="Shop"
            defaultValue={shopFilter}
            style={{ minHeight: 34, minWidth: 150, maxWidth: "100%", borderRadius: 7, border: "1.25px solid #5E7DA5", background: "#FFFFFF", color: "#12234A", padding: "0 12px" }}
          >
            <option value="">Selected company</option>
            {uniqueShops.map(([shopId, shopName]) => (
              <option key={shopId} value={shopId}>{shopName}</option>
            ))}
          </select>
          <select
            name="access"
            aria-label="Access mode"
            defaultValue={accessFilter}
            style={{ minHeight: 34, minWidth: 130, borderRadius: 7, border: "1.25px solid #5E7DA5", background: "#FFFFFF", color: "#12234A", padding: "0 12px" }}
          >
            <option value="all">All access modes</option>
            <option value="full">Full</option>
            <option value="read only">Read only</option>
            <option value="blocked">Blocked</option>
          </select>
          <button
            type="submit"
            style={{ minHeight: 34, padding: "0 14px", borderRadius: 7, border: "1px solid #0755FF", background: "#0755FF", color: "#FFFFFF", fontWeight: 700, cursor: "pointer" }}
          >
            Apply
          </button>
          <ControlActionLink href="/devices">Clear</ControlActionLink>
        </CompanyForm>

      <ControlPanel title="Registered devices" description="Latest 500 company devices. Filters apply to these loaded rows; Open shows the full device detail.">
        {filteredRows.length === 0 ? (
          <ControlEmptyState
            title="No devices matched the current filters"
            description="No matches in the latest 500 company devices. Try wider filters."
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
                        <div style={{ fontSize: 14, fontWeight: 600, color: "#12234A" }}>{row.name}</div>
                        <div style={{ fontSize: 12.5, color: "#536A96" }}>{row.id}</div>
                      </div>
                    </ControlTableCell>
                    <ControlTableCell><span style={{ whiteSpace: "nowrap" }}>{row.device_type ? row.device_type.replaceAll("_", " ") : "Not surfaced"}</span></ControlTableCell>
                    <ControlTableCell>{row.shop_name ?? row.shop_id ?? "Unassigned"}</ControlTableCell>
                    <ControlTableCell>
                      <div style={{ display: "grid", gap: 6, justifyItems: "start" }}>
                        <ControlStatusChip label={row.status ? row.status.replaceAll("_", " ") : "Unknown"} tone={toneFromDeviceStatus(row.status)} />
                        <div style={{ fontSize: 12.5, color: "#536A96" }}>{row.active_token_count} active token{row.active_token_count === 1 ? "" : "s"}</div>
                      </div>
                    </ControlTableCell>
                    <ControlTableCell>{formatMaybeDate(row.merged_last_seen_at)}</ControlTableCell>
                    <ControlTableCell>{row.reported_version ?? "Not surfaced"}</ControlTableCell>
                    <ControlTableCell>
                      <div style={{ display: "grid", gap: 6, justifyItems: "start" }}>
                        <ControlStatusChip label={row.access_mode} tone={row.access_mode.toLowerCase() === "full" ? "success" : row.access_mode.toLowerCase() === "blocked" ? "danger" : "warning"} />
                        <div style={{ fontSize: 12.5, color: "#536A96", lineHeight: 1.5 }}>{row.access_reason}</div>
                      </div>
                    </ControlTableCell>
                    <ControlTableCell>
                      <ControlStatusChip label={capabilityLabel(row)} tone={toneFromCapability(row)} />
                    </ControlTableCell>
                    <ControlTableCell>
                      <div style={{ display: "grid", gap: 6, justifyItems: "start" }}>
                        <ControlStatusChip label={row.update_label} tone={toneFromUpdateStatus(row)} />
                        <div style={{ fontSize: 12.5, color: "#536A96", lineHeight: 1.5 }}>
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
        <p style={{ margin: 0, fontSize: 12.5, color: "#536A96" }}>Last check-in shows the latest report, not a live connection. Scroll the table to see every column.</p>
      </ControlPanel>
      <style>{`
        .control-devices .control-table th { white-space: nowrap; }
        .control-devices .control-table td:first-child { min-width: 160px; }
        .control-devices .control-table td:nth-child(5),
        .control-devices .control-table td:nth-child(6) { white-space: nowrap; }
        .control-devices .control-table th:last-child,
        .control-devices .control-table td:last-child {
          position: sticky; right: 0; background: #FFFFFF; box-shadow: -1px 0 #5E7DA5;
        }
        .control-devices .control-table th:last-child { background: #EDF3FC; z-index: 2; }
        @media (max-width: 650px) {
          .control-device-filters > input,
          .control-device-filters > select { flex: 1 1 100% !important; width: 100%; min-width: 0 !important; }
        }
      `}</style>
    </div>
  );
}
