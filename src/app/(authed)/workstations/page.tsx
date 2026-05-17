import React from "react";
import { ControlActionLink } from "@/components/control/ControlActionButton";
import ControlEmptyState from "@/components/control/ControlEmptyState";
import ControlMetricCard from "@/components/control/ControlMetricCard";
import ControlPageHeader from "@/components/control/ControlPageHeader";
import ControlPanel from "@/components/control/ControlPanel";
import ControlStatusChip, { type ControlStatusTone } from "@/components/control/ControlStatusChip";
import { ControlTable, ControlTableCell, ControlTableHeadCell, ControlTableWrap } from "@/components/control/ControlTable";
import { loadDeviceViewRows } from "@/lib/control/deviceViews";
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

function updateTone(label: string): ControlStatusTone {
  const value = label.toLowerCase();
  if (value.includes("current")) return "success";
  if (value.includes("pinned") || value.includes("below")) return "danger";
  if (value.includes("unknown") || value.includes("format")) return "warning";
  return "neutral";
}

export default async function WorkstationsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = (await searchParams) ?? {};
  const statusFilter = firstParam(params.status).trim().toLowerCase() || "all";
  const shopFilter = firstParam(params.shop).trim();
  const accessFilter = firstParam(params.access).trim().toLowerCase() || "all";

  const { context, rows } = await loadDeviceViewRows();

  if (!context.isPlatformAdmin) {
    return (
      <div style={{ display: "grid", gap: 18 }}>
        <ControlPageHeader
          eyebrow="Workstations"
          title="Workstations"
          description="This area stays restricted to platform-admin sessions because it exposes workstation enrollment and access authority across shops."
          actions={<ControlActionLink href="/dashboard">Return to command center</ControlActionLink>}
        />
        <ControlPanel>
          <ControlEmptyState
            title="Platform admin access required"
            description="Open Workstations with a platform-admin AAL2 session to review registered workstation devices."
          />
        </ControlPanel>
      </div>
    );
  }

  const workstationRows = rows.filter((row) => String(row.device_type ?? "").trim().toLowerCase() === "workstation");
  const filteredRows = workstationRows.filter((row) => {
    if (statusFilter !== "all" && String(row.status ?? "").trim().toLowerCase() !== statusFilter) return false;
    if (shopFilter && String(row.shop_id ?? "") !== shopFilter) return false;
    if (accessFilter !== "all" && row.access_mode.toLowerCase() !== accessFilter) return false;
    return true;
  });

  const uniqueShops = [...new Map(workstationRows.filter((row) => row.shop_id).map((row) => [row.shop_id as string, row.shop_name ?? row.shop_id as string])).entries()];
  const activeRecent = workstationRows.filter((row) => Boolean(row.merged_last_seen_at)).length;
  const blocked = workstationRows.filter((row) => row.access_mode.toLowerCase() === "blocked" || String(row.status ?? "").trim().toLowerCase() !== "active").length;
  const needsUpdate = workstationRows.filter((row) => row.update_status === "required" || row.update_status === "warning").length;

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <ControlPageHeader
        eyebrow="Workstations"
        title="Workstations"
        description="Control view of registered workstation devices, validation posture, and effective access decisions."
        actions={<ControlActionLink href="/devices">Open all devices</ControlActionLink>}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
        <ControlMetricCard label="Registered Workstations" value={String(workstationRows.length)} meta="All enrolled workstation device rows in Control." tone="neutral" />
        <ControlMetricCard label="Active / Recent" value={String(activeRecent)} meta="Workstations with a surfaced recent check-in." tone={activeRecent > 0 ? "success" : "warning"} />
        <ControlMetricCard label="Blocked" value={String(blocked)} meta="Blocked by shop access or disabled at the device record level." tone={blocked > 0 ? "danger" : "success"} />
        <ControlMetricCard label="Needs Update" value={String(needsUpdate)} meta="Workstations below minimum, pinned-mismatched, or missing version data." tone={needsUpdate > 0 ? "warning" : "success"} />
      </div>

      <ControlPanel
        title="Workstation Directory"
        description="Table-first workstation surface using the same Control authority data as the broader Devices area."
      >
        <form method="get" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
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
            <option value="blocked">Blocked</option>
          </select>
          <button
            type="submit"
            style={{ minHeight: 38, padding: "0 14px", borderRadius: 12, border: "1px solid rgba(37, 99, 235, 0.36)", background: "rgba(37, 99, 235, 0.18)", color: "#F8FAFC", fontWeight: 700, cursor: "pointer" }}
          >
            Apply
          </button>
          <ControlActionLink href="/workstations">Clear</ControlActionLink>
        </form>

        {filteredRows.length === 0 ? (
          <ControlEmptyState
            title="No workstations matched the current filters"
            description="Try a wider filter combination or wait for workstation registrations to appear in Control."
          />
        ) : (
          <ControlTableWrap>
            <ControlTable minWidth={1220}>
              <thead>
                <tr>
                  <ControlTableHeadCell>Workstation Name</ControlTableHeadCell>
                  <ControlTableHeadCell>Shop</ControlTableHeadCell>
                  <ControlTableHeadCell>Status</ControlTableHeadCell>
                  <ControlTableHeadCell>Validation</ControlTableHeadCell>
                  <ControlTableHeadCell>Last Check-In</ControlTableHeadCell>
                  <ControlTableHeadCell>Access Mode</ControlTableHeadCell>
                  <ControlTableHeadCell>Version</ControlTableHeadCell>
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
                    <ControlTableCell>{row.shop_name ?? row.shop_id ?? "Unassigned"}</ControlTableCell>
                    <ControlTableCell><ControlStatusChip label={row.status ? row.status.replaceAll("_", " ") : "Unknown"} tone={String(row.status ?? "").trim().toLowerCase() === "active" ? "success" : "danger"} /></ControlTableCell>
                    <ControlTableCell>
                      <div style={{ display: "grid", gap: 6 }}>
                        <ControlStatusChip label={row.update_label} tone={updateTone(row.update_label)} />
                        <div style={{ fontSize: 12, color: "#64748B", lineHeight: 1.5 }}>{row.update_detail}</div>
                      </div>
                    </ControlTableCell>
                    <ControlTableCell>{formatMaybeDate(row.merged_last_seen_at)}</ControlTableCell>
                    <ControlTableCell><ControlStatusChip label={row.access_mode} tone={row.access_mode.toLowerCase() === "full" ? "success" : "danger"} /></ControlTableCell>
                    <ControlTableCell>{row.reported_version ?? "Not surfaced"}</ControlTableCell>
                    <ControlTableCell align="right">
                      <ControlActionLink href={`/devices/${row.id}`} tone="secondary">Open device</ControlActionLink>
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
