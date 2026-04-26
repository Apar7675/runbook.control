"use client";

import React from "react";
import { ControlActionButtonV2, ControlActionLinkV2 } from "@/components/control/v2/ControlActionButtonV2";
import { ControlInputV2 } from "@/components/control/v2/ControlFieldV2";
import { ControlTableV2, ControlTableCellV2, ControlTableHeadCellV2, ControlTableWrapV2 } from "@/components/control/v2/ControlTableV2";
import { controlV2Theme as t } from "@/components/control/v2/controlV2Theme";
import { safeFetch } from "@/lib/http/safeFetch";
import { formatDateTime } from "@/lib/ui/dates";

type AuditRow = {
  id: string;
  created_at: string;
  shop_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  actor_user_id: string | null;
  actor_email: string | null;
  meta: any;
};

type AuditResp = { ok: true; rows: AuditRow[] } | { ok?: false; error?: string };

function buildUrl(params: {
  action: string;
  actor_email: string;
  shop_id: string;
  target_id: string;
  before: string;
  limit: string;
}) {
  const search = new URLSearchParams();
  search.set("limit", params.limit || "200");
  if (params.action.trim()) search.set("action", params.action.trim());
  if (params.actor_email.trim()) search.set("actor_email", params.actor_email.trim());
  if (params.shop_id.trim()) search.set("shop_id", params.shop_id.trim());
  if (params.target_id.trim()) search.set("target_id", params.target_id.trim());
  if (params.before.trim()) search.set("before", params.before.trim());
  return `/api/audit/list?${search.toString()}`;
}

function buildExportUrl(params: {
  action: string;
  actor_email: string;
  shop_id: string;
  target_id: string;
  before: string;
  limit: string;
}) {
  const search = new URLSearchParams();
  search.set("limit", params.limit || "200");
  if (params.action.trim()) search.set("action", params.action.trim());
  if (params.actor_email.trim()) search.set("actor_email", params.actor_email.trim());
  if (params.shop_id.trim()) search.set("shop_id", params.shop_id.trim());
  if (params.target_id.trim()) search.set("target_id", params.target_id.trim());
  if (params.before.trim()) search.set("before", params.before.trim());
  return `/api/audit/export?${search.toString()}`;
}

function resultLabel(row: AuditRow) {
  if (typeof row?.meta?.success === "boolean") return row.meta.success ? "Success" : "Failed";
  const metaStatus = String(row?.meta?.result ?? row?.meta?.status ?? "").trim();
  if (metaStatus) return metaStatus;
  return "No result";
}

function detailsLabel(row: AuditRow) {
  if (row.target_type || row.target_id) {
    return `${row.target_type ?? "event"} ${row.target_id ?? ""}`.trim();
  }
  const meta = row.meta ?? null;
  if (meta && typeof meta === "object" && Object.keys(meta).length > 0) {
    const compact = JSON.stringify(meta);
    return compact.length > 140 ? `${compact.slice(0, 137)}...` : compact;
  }
  return "No additional detail";
}

export default function AuditLogWorkspaceV2({
  initialFilters,
}: {
  initialFilters: {
    action: string;
    actor_email: string;
    shop_id: string;
    target_id: string;
    before: string;
    limit: string;
  };
}) {
  const [filters, setFilters] = React.useState(initialFilters);
  const [draft, setDraft] = React.useState(initialFilters);
  const [rows, setRows] = React.useState<AuditRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [status, setStatus] = React.useState("");

  async function load(nextFilters = filters) {
    setLoading(true);
    const response = await safeFetch<AuditResp>(buildUrl(nextFilters), {
      credentials: "include",
      cache: "no-store",
    });

    if (!response.ok || !(response.data as any)?.ok) {
      setStatus(response.ok ? (response.data as any)?.error ?? "Unable to load audit log." : `${response.status}: ${response.error}`);
      setRows([]);
      setLoading(false);
      return;
    }

    setRows((response.data as any).rows ?? []);
    setStatus("");
    setLoading(false);
  }

  React.useEffect(() => {
    void load(initialFilters);
  }, []);

  function applyFilters(event: React.FormEvent) {
    event.preventDefault();
    setFilters(draft);
    void load(draft);
  }

  function clearFilters() {
    const cleared = {
      action: "",
      actor_email: "",
      shop_id: "",
      target_id: "",
      before: "",
      limit: "200",
    };
    setDraft(cleared);
    setFilters(cleared);
    void load(cleared);
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ color: t.color.textQuiet, ...t.type.label }}>Audit / Activity</div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>Audit log</h1>
          <div style={{ fontSize: 13, color: t.color.textQuiet }}>Search and review Control activity as a dense operator log.</div>
        </div>
        <ControlActionLinkV2 href={buildExportUrl(filters)} tone="primary">Export audit</ControlActionLinkV2>
      </div>

      <form onSubmit={applyFilters} style={{ display: "grid", gap: 8 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 8 }}>
          <ControlInputV2 value={draft.action} onChange={(event) => setDraft((value) => ({ ...value, action: event.target.value }))} placeholder="Action contains" />
          <ControlInputV2 value={draft.actor_email} onChange={(event) => setDraft((value) => ({ ...value, actor_email: event.target.value }))} placeholder="Actor email" />
          <ControlInputV2 value={draft.shop_id} onChange={(event) => setDraft((value) => ({ ...value, shop_id: event.target.value }))} placeholder="Shop id" />
          <ControlInputV2 value={draft.target_id} onChange={(event) => setDraft((value) => ({ ...value, target_id: event.target.value }))} placeholder="Target id" />
          <ControlInputV2 value={draft.before} onChange={(event) => setDraft((value) => ({ ...value, before: event.target.value }))} placeholder="Before (ISO)" />
          <ControlInputV2 value={draft.limit} onChange={(event) => setDraft((value) => ({ ...value, limit: event.target.value }))} placeholder="Limit" />
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <ControlActionButtonV2 type="submit" tone="primary">
            Apply
          </ControlActionButtonV2>
          <ControlActionButtonV2 type="button" onClick={clearFilters}>
            Clear
          </ControlActionButtonV2>
          <div style={{ fontSize: 12, color: t.color.textQuiet }}>{rows.length} row{rows.length === 1 ? "" : "s"}</div>
        </div>
      </form>

      {status ? <div style={{ fontSize: 12.5, color: t.color.textMuted }}>{status}</div> : null}

      <ControlTableWrapV2>
        <ControlTableV2 minWidth={1080}>
          <thead>
            <tr>
              <ControlTableHeadCellV2>Time</ControlTableHeadCellV2>
              <ControlTableHeadCellV2>Action</ControlTableHeadCellV2>
              <ControlTableHeadCellV2>Actor</ControlTableHeadCellV2>
              <ControlTableHeadCellV2>Target</ControlTableHeadCellV2>
              <ControlTableHeadCellV2>Result</ControlTableHeadCellV2>
              <ControlTableHeadCellV2>Details</ControlTableHeadCellV2>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ padding: 16, color: t.color.textMuted }}>Loading audit log...</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 16, color: t.color.textMuted }}>No audit rows matched the current filters.</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <ControlTableCellV2>{formatDateTime(row.created_at)}</ControlTableCellV2>
                  <ControlTableCellV2><span style={{ fontWeight: 700, color: t.color.text }}>{row.action}</span></ControlTableCellV2>
                  <ControlTableCellV2>{row.actor_email ?? row.actor_user_id ?? "System"}</ControlTableCellV2>
                  <ControlTableCellV2>{row.target_type ?? "event"} {row.target_id ?? ""}</ControlTableCellV2>
                  <ControlTableCellV2>{resultLabel(row)}</ControlTableCellV2>
                  <ControlTableCellV2>{detailsLabel(row)}</ControlTableCellV2>
                </tr>
              ))
            )}
          </tbody>
        </ControlTableV2>
      </ControlTableWrapV2>
    </div>
  );
}
