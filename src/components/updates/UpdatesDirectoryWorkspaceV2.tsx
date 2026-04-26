"use client";

import React from "react";
import { ControlActionButtonV2, ControlActionLinkV2 } from "@/components/control/v2/ControlActionButtonV2";
import ControlBadgeV2, { toneFromStatusV2 } from "@/components/control/v2/ControlBadgeV2";
import { ControlInputV2, ControlSelectV2 } from "@/components/control/v2/ControlFieldV2";
import ControlMetricStripV2 from "@/components/control/v2/ControlMetricStripV2";
import { ControlTableCellV2, ControlTableHeadCellV2, ControlTableV2, ControlTableWrapV2 } from "@/components/control/v2/ControlTableV2";
import { controlV2Theme as t } from "@/components/control/v2/controlV2Theme";
import { safeFetch } from "@/lib/http/safeFetch";
import { formatDateTime } from "@/lib/ui/dates";

type UpdatePackage = {
  id: string;
  channel: string | null;
  version: string | null;
  file_path: string | null;
  notes: string | null;
  sha256: string | null;
  created_at: string | null;
  updated_at: string | null;
  created_by: string | null;
};

type UpdatesResponse = {
  ok: true;
  packages: UpdatePackage[];
} | {
  ok?: false;
  error?: string;
};

type SortKey = "created" | "updated" | "channel" | "version";

function parseTime(value: string | null) {
  const ms = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(ms) ? ms : 0;
}

function packageName(row: UpdatePackage) {
  const path = String(row.file_path ?? "").trim();
  if (!path) return "Unnamed package";
  const parts = path.split("/").filter(Boolean);
  return parts[parts.length - 1] || path;
}

function packageStatus(row: UpdatePackage) {
  if (row.file_path) return "Recorded";
  return "No path";
}

function detailsText(row: UpdatePackage) {
  if (row.notes) return row.notes;
  if (row.sha256) return `sha256 ${String(row.sha256).slice(0, 10)}...`;
  return "No package notes";
}

export default function UpdatesDirectoryWorkspaceV2() {
  const [rows, setRows] = React.useState<UpdatePackage[]>([]);
  const [status, setStatus] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [query, setQuery] = React.useState("");
  const [channelFilter, setChannelFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [sort, setSort] = React.useState<SortKey>("created");

  async function load() {
    setLoading(true);
    setStatus("");

    const response = await safeFetch<UpdatesResponse>("/api/updates/list", {
      credentials: "include",
      cache: "no-store",
    });

    if (!response.ok) {
      setStatus(`${response.status}: ${response.error}`);
      setLoading(false);
      return;
    }

    const payload: any = response.data;
    if (!payload?.ok) {
      setStatus(payload?.error ?? "Could not load update packages.");
      setLoading(false);
      return;
    }

    setRows(payload.packages ?? []);
    setLoading(false);
  }

  React.useEffect(() => {
    void load();
  }, []);

  const summary = React.useMemo(() => {
    const stable = rows.filter((row) => String(row.channel ?? "").toLowerCase() === "stable").length;
    const beta = rows.filter((row) => String(row.channel ?? "").toLowerCase() === "beta").length;
    const recent = rows.filter((row) => {
      const ts = parseTime(row.created_at);
      if (!ts) return false;
      return Date.now() - ts <= 30 * 24 * 60 * 60 * 1000;
    }).length;

    return {
      total: rows.length,
      stable,
      beta,
      recent,
    };
  }, [rows]);

  const filteredRows = React.useMemo(() => {
    const needle = query.trim().toLowerCase();

    return [...rows]
      .filter((row) => {
        if (channelFilter !== "all" && String(row.channel ?? "").toLowerCase() !== channelFilter) return false;
        if (statusFilter !== "all" && packageStatus(row).toLowerCase() !== statusFilter) return false;
        return true;
      })
      .filter((row) => {
        if (!needle) return true;
        return [
          packageName(row),
          row.channel,
          row.version,
          row.file_path,
          row.notes,
          row.created_by,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle));
      })
      .sort((a, b) => {
        if (sort === "updated") return parseTime(b.updated_at) - parseTime(a.updated_at);
        if (sort === "channel") return String(a.channel ?? "").localeCompare(String(b.channel ?? ""));
        if (sort === "version") return String(b.version ?? "").localeCompare(String(a.version ?? ""));
        return parseTime(b.created_at) - parseTime(a.created_at);
      });
  }, [channelFilter, query, rows, sort, statusFilter]);

  async function copyPath(path: string | null) {
    if (!path) {
      setStatus("No file path is available for this package.");
      return;
    }

    try {
      await navigator.clipboard.writeText(path);
      setStatus(`Copied path: ${path}`);
    } catch {
      setStatus("Could not copy the package path from this browser.");
    }
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "start" }}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ color: t.color.textQuiet, ...t.type.label }}>Updates</div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>Update packages</h1>
          <div style={{ fontSize: 13, color: t.color.textQuiet }}>
            The packages table is the operator surface for release inventory, channel review, and upload follow-up.
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <ControlActionLinkV2 href="/updates/packages">Upload package</ControlActionLinkV2>
          <ControlActionButtonV2 onClick={load} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </ControlActionButtonV2>
        </div>
      </div>

      <ControlMetricStripV2
        items={[
          { label: "Packages", value: String(summary.total) },
          { label: "Stable", value: String(summary.stable) },
          { label: "Beta", value: String(summary.beta) },
          { label: "Recent 30d", value: String(summary.recent) },
        ]}
      />

      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <ControlInputV2 value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search packages" style={{ minWidth: 240 }} />
          <ControlSelectV2 value={channelFilter} onChange={(event) => setChannelFilter(event.target.value)} style={{ minWidth: 140 }}>
            <option value="all">All channels</option>
            <option value="stable">Stable</option>
            <option value="beta">Beta</option>
          </ControlSelectV2>
          <ControlSelectV2 value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={{ minWidth: 140 }}>
            <option value="all">All status</option>
            <option value="recorded">Recorded</option>
            <option value="no path">No path</option>
          </ControlSelectV2>
          <ControlSelectV2 value={sort} onChange={(event) => setSort(event.target.value as SortKey)} style={{ minWidth: 150 }}>
            <option value="created">Sort: created</option>
            <option value="updated">Sort: updated</option>
            <option value="channel">Sort: channel</option>
            <option value="version">Sort: version</option>
          </ControlSelectV2>
        </div>
      </div>

      {status ? <div style={{ fontSize: 12.5, color: t.color.textMuted }}>{status}</div> : null}

      <ControlTableWrapV2>
        <ControlTableV2 minWidth={1040}>
          <thead>
            <tr>
              <ControlTableHeadCellV2>Package</ControlTableHeadCellV2>
              <ControlTableHeadCellV2>Channel</ControlTableHeadCellV2>
              <ControlTableHeadCellV2>Version</ControlTableHeadCellV2>
              <ControlTableHeadCellV2>Status</ControlTableHeadCellV2>
              <ControlTableHeadCellV2>Created</ControlTableHeadCellV2>
              <ControlTableHeadCellV2>Updated</ControlTableHeadCellV2>
              <ControlTableHeadCellV2 align="right">Actions</ControlTableHeadCellV2>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ padding: 16, color: t.color.textMuted }}>Loading packages...</td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 16, color: t.color.textMuted }}>No packages matched the current filters.</td>
              </tr>
            ) : (
              filteredRows.map((row) => {
                const state = packageStatus(row);
                return (
                  <tr key={row.id}>
                    <ControlTableCellV2>
                      <div style={{ display: "grid", gap: 3 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: t.color.text }}>{packageName(row)}</div>
                        <div style={{ color: t.color.textQuiet, fontSize: 11.5 }}>{detailsText(row)}</div>
                      </div>
                    </ControlTableCellV2>
                    <ControlTableCellV2>{row.channel ?? "Unknown"}</ControlTableCellV2>
                    <ControlTableCellV2>{row.version ?? "Unknown"}</ControlTableCellV2>
                    <ControlTableCellV2>
                      <ControlBadgeV2 label={state} tone={toneFromStatusV2(state)} />
                    </ControlTableCellV2>
                    <ControlTableCellV2>{row.created_at ? formatDateTime(row.created_at) : "Unknown"}</ControlTableCellV2>
                    <ControlTableCellV2>{row.updated_at ? formatDateTime(row.updated_at) : "Unknown"}</ControlTableCellV2>
                    <ControlTableCellV2 align="right">
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                        <ControlActionButtonV2 onClick={() => void copyPath(row.file_path)}>
                          Copy path
                        </ControlActionButtonV2>
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
  );
}
