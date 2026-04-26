"use client";

import React from "react";
import { ControlActionButtonV2, ControlActionLinkV2 } from "@/components/control/v2/ControlActionButtonV2";
import ControlBadgeV2, { toneFromStatusV2 } from "@/components/control/v2/ControlBadgeV2";
import { ControlInputV2, ControlSelectV2 } from "@/components/control/v2/ControlFieldV2";
import { controlV2Theme as t } from "@/components/control/v2/controlV2Theme";
import { ControlTableV2, ControlTableCellV2, ControlTableHeadCellV2, ControlTableWrapV2 } from "@/components/control/v2/ControlTableV2";
import { formatDateTime } from "@/lib/ui/dates";

export type ShopDirectoryRowV2 = {
  id: string;
  name: string;
  member_role: string;
  access_display_status: string;
  access_summary: string;
  billing_status: string;
  employees_active: number;
  employees_total: number;
  devices_active: number;
  devices_total: number;
  offline_devices: number;
  stale_devices: number;
  recent_audit_events: number;
  last_activity_at: string | null;
  created_at: string | null;
};

type ViewKey = "all" | "restricted" | "review" | "attention" | "newest";
type SortKey = "attention" | "name" | "last_activity" | "people" | "devices";

function ThinMetric({
  label,
  value,
  meta,
}: {
  label: string;
  value: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        alignItems: "baseline",
        padding: "4px 0",
      }}
    >
      <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.34, lineHeight: 1 }}>{value}</span>
      <span style={{ display: "grid", gap: 2 }}>
        <span style={{ color: t.color.textQuiet, ...t.type.label }}>{label}</span>
        {meta ? <span style={{ fontSize: 11.5, color: t.color.textQuiet }}>{meta}</span> : null}
      </span>
    </div>
  );
}

function parseTime(value: string | null) {
  const ms = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(ms) ? ms : 0;
}

function viewMatches(view: ViewKey, row: ShopDirectoryRowV2) {
  const accessTone = toneFromStatusV2(row.access_display_status);
  const attention = row.offline_devices + row.stale_devices;

  if (view === "restricted") return accessTone === "danger";
  if (view === "review") return accessTone === "warning" || accessTone === "danger";
  if (view === "attention") return attention > 0;
  if (view === "newest") return true;
  return true;
}

function countForView(view: ViewKey, rows: ShopDirectoryRowV2[]) {
  if (view === "newest") return rows.length;
  return rows.filter((row) => viewMatches(view, row)).length;
}

function compareRows(sort: SortKey, a: ShopDirectoryRowV2, b: ShopDirectoryRowV2) {
  if (sort === "name") return a.name.localeCompare(b.name);
  if (sort === "last_activity") return parseTime(b.last_activity_at) - parseTime(a.last_activity_at);
  if (sort === "people") return b.employees_total - a.employees_total;
  if (sort === "devices") return b.devices_total - a.devices_total;
  return (b.offline_devices + b.stale_devices) - (a.offline_devices + a.stale_devices);
}

export default function ShopsDirectoryWorkspaceV2({
  isPlatformAdmin,
  manageableShopCount,
  deviceCount,
  rows,
}: {
  isPlatformAdmin: boolean;
  manageableShopCount: number;
  deviceCount: number;
  rows: ShopDirectoryRowV2[];
}) {
  const [query, setQuery] = React.useState("");
  const [view, setView] = React.useState<ViewKey>("all");
  const [sort, setSort] = React.useState<SortKey>("attention");

  const restrictedCount = React.useMemo(
    () => rows.filter((row) => toneFromStatusV2(row.access_display_status) === "danger").length,
    [rows]
  );
  const reviewCount = React.useMemo(
    () => rows.filter((row) => {
      const tone = toneFromStatusV2(row.access_display_status);
      return tone === "warning" || tone === "danger";
    }).length,
    [rows]
  );
  const attentionCount = React.useMemo(
    () => rows.filter((row) => row.offline_devices + row.stale_devices > 0).length,
    [rows]
  );

  const filteredRows = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    let next = rows.filter((row) => viewMatches(view, row));

    if (view === "newest") {
      next = [...next].sort((a, b) => parseTime(b.created_at) - parseTime(a.created_at));
    } else {
      next = [...next].sort((a, b) => compareRows(sort, a, b));
    }

    if (!needle) return next;

    return next.filter((row) =>
      [
        row.name,
        row.member_role,
        row.access_display_status,
        row.billing_status,
        row.access_summary,
      ].some((value) => String(value ?? "").toLowerCase().includes(needle))
    );
  }, [query, rows, sort, view]);

  const views: Array<{ key: ViewKey; label: string }> = [
    { key: "all", label: "All" },
    { key: "restricted", label: "Restricted" },
    { key: "review", label: "Review" },
    { key: "attention", label: "Attention" },
    { key: "newest", label: "Newest" },
  ];

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ color: t.color.textQuiet, ...t.type.label }}>Shops</div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>{isPlatformAdmin ? "Control overview" : "Your shops"}</h1>
          <div style={{ fontSize: 13, color: t.color.textQuiet }}>The shop directory is the primary operator surface for search, scan, billing escalation, and access review.</div>
        </div>
        {isPlatformAdmin ? <ControlActionLinkV2 href="/create-shop" tone="primary">Create shop</ControlActionLinkV2> : null}
      </div>

      <div
        style={{
          display: "flex",
          gap: 22,
          flexWrap: "wrap",
          alignItems: "center",
          paddingBottom: 10,
          borderBottom: `1px solid ${t.color.border}`,
        }}
      >
        <ThinMetric label="Shops" value={manageableShopCount} meta="Visible to this account" />
        <ThinMetric label="Restricted" value={restrictedCount} meta="Blocked or restricted access" />
        <ThinMetric label="Review" value={reviewCount + attentionCount} meta="Needs operator follow-up" />
        <ThinMetric label="Devices" value={deviceCount} meta="Registered across visible shops" />
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {views.map((entry) => {
              const active = view === entry.key;
              return (
                <ControlActionButtonV2
                  key={entry.key}
                  tone={active ? "primary" : "ghost"}
                  onClick={() => setView(entry.key)}
                >
                  {entry.label} ({countForView(entry.key, rows)})
                </ControlActionButtonV2>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <ControlInputV2
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search shops"
              style={{ minWidth: 240 }}
            />
            <ControlSelectV2 value={sort} onChange={(e) => setSort(e.target.value as SortKey)} style={{ minWidth: 150 }} disabled={view === "newest"}>
              <option value="attention">Sort: attention</option>
              <option value="last_activity">Sort: last activity</option>
              <option value="name">Sort: name</option>
              <option value="people">Sort: people</option>
              <option value="devices">Sort: devices</option>
            </ControlSelectV2>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontSize: 12, color: t.color.textQuiet }}>
            {filteredRows.length} shop{filteredRows.length === 1 ? "" : "s"} in view
          </div>
          {view === "attention" ? (
            <div style={{ fontSize: 12, color: t.color.textQuiet }}>Attention is ranked by offline + stale device count.</div>
          ) : view === "newest" ? (
            <div style={{ fontSize: 12, color: t.color.textQuiet }}>Newest is ranked by shop creation date.</div>
          ) : null}
        </div>

        <ControlTableWrapV2>
          <ControlTableV2 minWidth={980}>
            <thead>
              <tr>
                <ControlTableHeadCellV2>Shop</ControlTableHeadCellV2>
                <ControlTableHeadCellV2>Access</ControlTableHeadCellV2>
                <ControlTableHeadCellV2>Billing</ControlTableHeadCellV2>
                <ControlTableHeadCellV2>People</ControlTableHeadCellV2>
                <ControlTableHeadCellV2>Devices</ControlTableHeadCellV2>
                <ControlTableHeadCellV2>Attention</ControlTableHeadCellV2>
                <ControlTableHeadCellV2>Last Activity</ControlTableHeadCellV2>
                <ControlTableHeadCellV2 align="right">Action</ControlTableHeadCellV2>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 16, color: t.color.textMuted }}>
                    No shops matched the current search and view.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const deviceStatus =
                    row.offline_devices > 0 ? "Action Needed" : row.stale_devices > 0 ? "Warning" : "Healthy";

                  return (
                    <tr key={row.id}>
                      <ControlTableCellV2>
                        <div style={{ display: "grid", gap: 3 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: t.color.text }}>{row.name}</div>
                          <div style={{ color: t.color.textQuiet, fontSize: 11.5 }}>{row.member_role}</div>
                        </div>
                      </ControlTableCellV2>
                      <ControlTableCellV2>
                        <div style={{ display: "grid", gap: 6 }}>
                          <div><ControlBadgeV2 label={row.access_display_status} tone={toneFromStatusV2(row.access_display_status)} /></div>
                          <div style={{ fontSize: 11.5, color: t.color.textQuiet }}>{row.access_summary}</div>
                        </div>
                      </ControlTableCellV2>
                      <ControlTableCellV2>{row.billing_status}</ControlTableCellV2>
                      <ControlTableCellV2>{row.employees_active} active / {row.employees_total} total</ControlTableCellV2>
                      <ControlTableCellV2>
                        <div style={{ display: "grid", gap: 6 }}>
                          <div><ControlBadgeV2 label={deviceStatus} tone={toneFromStatusV2(deviceStatus)} /></div>
                          <div style={{ fontSize: 11.5, color: t.color.textQuiet }}>{row.devices_active} active of {row.devices_total}</div>
                        </div>
                      </ControlTableCellV2>
                      <ControlTableCellV2>{row.offline_devices} offline / {row.stale_devices} stale</ControlTableCellV2>
                      <ControlTableCellV2>{row.last_activity_at ? formatDateTime(row.last_activity_at) : "No recent signal"}</ControlTableCellV2>
                      <ControlTableCellV2 align="right">
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                          <ControlActionLinkV2 href={`/shops/${row.id}`} tone="primary">Open</ControlActionLinkV2>
                          <ControlActionLinkV2 href={`/shops/${row.id}?tab=billing`}>Billing</ControlActionLinkV2>
                          {isPlatformAdmin ? <ControlActionLinkV2 href={`/shops/${row.id}#danger`} tone="danger">Danger</ControlActionLinkV2> : null}
                        </div>
                      </ControlTableCellV2>
                    </tr>
                  );
                })
              )}
            </tbody>
          </ControlTableV2>
        </ControlTableWrapV2>
      </div>
    </div>
  );
}
