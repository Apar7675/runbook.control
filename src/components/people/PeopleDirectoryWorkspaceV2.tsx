"use client";

import React from "react";
import ControlMetricStripV2 from "@/components/control/v2/ControlMetricStripV2";
import { ControlActionButtonV2 } from "@/components/control/v2/ControlActionButtonV2";
import ControlBadgeV2, { toneFromStatusV2 } from "@/components/control/v2/ControlBadgeV2";
import { ControlInputV2, ControlSelectV2 } from "@/components/control/v2/ControlFieldV2";
import { ControlTableV2, ControlTableCellV2, ControlTableHeadCellV2, ControlTableWrapV2 } from "@/components/control/v2/ControlTableV2";
import { controlV2Theme as t } from "@/components/control/v2/controlV2Theme";
import ShopUserDrawer, { type ShopUserRow } from "@/components/shops/ShopUserDrawer";
import { safeFetch } from "@/lib/http/safeFetch";
import { formatDateTime } from "@/lib/ui/dates";

type PeopleRow = ShopUserRow & {
  trusted_device_count: number;
  trusted_recorded_at: string | null;
};

type PeopleResponse = {
  ok: true;
  summary: {
    employee_count: number;
    active_employee_count: number;
    mobile_ready_count: number;
    workstation_ready_count: number;
    trusted_device_count: number;
  };
  users: PeopleRow[];
};

type SortKey = "name" | "role" | "status" | "devices" | "recorded";
type QueryState = "loading" | "ready" | "error";

function statusLabel(row: PeopleRow) {
  if (row.is_active && row.runbook_access_enabled && row.membership_is_active !== false) return "Active";
  if (row.mobile_access_enabled || row.workstation_access_enabled) return "Warning";
  return "Inactive";
}

function devicesLabel(row: PeopleRow) {
  if (row.trusted_device_count > 0) return `${row.trusted_device_count} trusted`;
  const enabled: string[] = [];
  if (row.mobile_access_enabled) enabled.push("Mobile");
  if (row.workstation_access_enabled) enabled.push("Workstation");
  if (enabled.length > 0) return enabled.join(" + ");
  return "None";
}

function parseTime(value: string | null) {
  const ms = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(ms) ? ms : 0;
}

export default function PeopleDirectoryWorkspaceV2({
  shopId,
  shopName,
}: {
  shopId: string;
  shopName: string;
}) {
  const [queryState, setQueryState] = React.useState<QueryState>("loading");
  const [status, setStatus] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState("all");
  const [sort, setSort] = React.useState<SortKey>("name");
  const [summary, setSummary] = React.useState<PeopleResponse["summary"] | null>(null);
  const [rows, setRows] = React.useState<PeopleRow[]>([]);
  const [selectedRow, setSelectedRow] = React.useState<PeopleRow | null>(null);
  const loading = queryState === "loading";
  const queryFailed = queryState === "error";

  async function loadPeople() {
    setQueryState("loading");
    setStatus("");
    const response = await safeFetch<PeopleResponse>(`/api/people/list?shop_id=${encodeURIComponent(shopId)}`, {
      credentials: "include",
      cache: "no-store",
    });

    if (!response.ok || !(response.data as any)?.ok) {
      setSummary(null);
      setRows([]);
      setStatus(response.ok ? (response.data as any)?.error ?? "Could not load people." : `${response.status}: ${response.error}`);
      setQueryState("error");
      return;
    }

    setSummary(response.data.summary);
    setRows(response.data.users ?? []);
    setStatus("");
    setQueryState("ready");
  }

  React.useEffect(() => {
    void loadPeople();
  }, [shopId]);

  const filteredRows = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    const next = rows
      .filter((row) => {
        if (roleFilter === "all") return true;
        return String(row.employee_role ?? row.membership_role ?? "").toLowerCase() === roleFilter;
      })
      .filter((row) => {
        if (!needle) return true;
        return [
          row.display_name,
          row.email,
          row.phone,
          row.employee_code,
          row.employee_role,
          row.membership_role,
          devicesLabel(row),
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle));
      });

    return [...next].sort((a, b) => {
      if (sort === "role") return String(a.employee_role ?? a.membership_role ?? "").localeCompare(String(b.employee_role ?? b.membership_role ?? ""));
      if (sort === "status") return statusLabel(a).localeCompare(statusLabel(b));
      if (sort === "devices") return b.trusted_device_count - a.trusted_device_count;
      if (sort === "recorded") return parseTime(b.trusted_recorded_at) - parseTime(a.trusted_recorded_at);
      return a.display_name.localeCompare(b.display_name);
    });
  }, [query, roleFilter, rows, sort]);

  const roleOptions = React.useMemo(() => {
    return Array.from(
      new Set(
        rows
          .map((row) => String(row.employee_role ?? row.membership_role ?? "").trim().toLowerCase())
          .filter(Boolean)
      )
    ).sort();
  }, [rows]);

  const metricItems = queryFailed
    ? [
        { label: "Employees", value: "Unavailable", meta: "Query failed" },
        { label: "Mobile Ready", value: "Unavailable", meta: "Query failed" },
        { label: "Workstation Ready", value: "Unavailable", meta: "Query failed" },
        { label: "Trusted Devices", value: "Unavailable", meta: "Query failed" },
      ]
    : [
        { label: "Employees", value: String(summary?.employee_count ?? 0), meta: `${summary?.active_employee_count ?? 0} active` },
        { label: "Mobile Ready", value: String(summary?.mobile_ready_count ?? 0) },
        { label: "Workstation Ready", value: String(summary?.workstation_ready_count ?? 0) },
        { label: "Trusted Devices", value: String(summary?.trusted_device_count ?? 0) },
      ];

  return (
    <>
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ color: t.color.textQuiet, ...t.type.label }}>People</div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>Shop People</h1>
          <div style={{ fontSize: 12.5, color: t.color.textQuiet }}>Showing people for {shopName}</div>
          <div style={{ fontSize: 13, color: t.color.textQuiet }}>Employees recorded for this shop, with provisioning and access status.</div>
        </div>

        <ControlMetricStripV2 items={metricItems} />

        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <ControlInputV2 value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search people" style={{ minWidth: 240 }} />
            <ControlSelectV2 value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} style={{ minWidth: 150 }}>
              <option value="all">All roles</option>
              {roleOptions.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </ControlSelectV2>
            <ControlSelectV2 value={sort} onChange={(e) => setSort(e.target.value as SortKey)} style={{ minWidth: 150 }}>
              <option value="name">Sort: name</option>
              <option value="role">Sort: role</option>
              <option value="status">Sort: status</option>
              <option value="devices">Sort: devices</option>
              <option value="recorded">Sort: recorded</option>
            </ControlSelectV2>
          </div>

          <ControlActionButtonV2 onClick={loadPeople} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </ControlActionButtonV2>
        </div>

        {status ? <div style={{ fontSize: 12.5, color: queryFailed ? t.color.danger : t.color.textMuted }}>{status}</div> : null}

        <ControlTableWrapV2>
          <ControlTableV2 minWidth={920}>
            <thead>
              <tr>
                <ControlTableHeadCellV2>Name</ControlTableHeadCellV2>
                <ControlTableHeadCellV2>Role</ControlTableHeadCellV2>
                <ControlTableHeadCellV2>Status</ControlTableHeadCellV2>
                <ControlTableHeadCellV2>Devices</ControlTableHeadCellV2>
                <ControlTableHeadCellV2>Recorded</ControlTableHeadCellV2>
                <ControlTableHeadCellV2 align="right">Actions</ControlTableHeadCellV2>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: 16, color: t.color.textMuted }}>Loading people...</td>
                </tr>
              ) : queryFailed ? (
                <tr>
                  <td colSpan={6} style={{ padding: 16, color: t.color.textMuted }}>People data is unavailable for the selected shop right now.</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 16, color: t.color.textMuted }}>No employees are recorded for this shop yet.</td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 16, color: t.color.textMuted }}>No people matched the current filters.</td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const statusValue = statusLabel(row);
                  return (
                    <tr key={`${row.employee_id ?? "membership"}:${row.auth_user_id ?? row.display_name}`}>
                      <ControlTableCellV2>
                        <div style={{ display: "grid", gap: 3 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: t.color.text }}>{row.display_name}</div>
                          <div style={{ color: t.color.textQuiet, fontSize: 11.5 }}>{row.email ?? row.employee_code ?? row.source}</div>
                        </div>
                      </ControlTableCellV2>
                      <ControlTableCellV2>{row.employee_role ?? row.membership_role ?? "Unassigned"}</ControlTableCellV2>
                      <ControlTableCellV2>
                        <ControlBadgeV2 label={statusValue} tone={toneFromStatusV2(statusValue)} />
                      </ControlTableCellV2>
                      <ControlTableCellV2>{devicesLabel(row)}</ControlTableCellV2>
                      <ControlTableCellV2>{row.trusted_recorded_at ? formatDateTime(row.trusted_recorded_at) : "No trusted device record"}</ControlTableCellV2>
                      <ControlTableCellV2 align="right">
                        <ControlActionButtonV2 onClick={() => setSelectedRow(row)}>Open</ControlActionButtonV2>
                      </ControlTableCellV2>
                    </tr>
                  );
                })
              )}
            </tbody>
          </ControlTableV2>
        </ControlTableWrapV2>
      </div>

      <ShopUserDrawer
        shopId={shopId}
        user={selectedRow}
        open={!!selectedRow}
        onClose={() => setSelectedRow(null)}
        onRemoved={loadPeople}
      />
    </>
  );
}
