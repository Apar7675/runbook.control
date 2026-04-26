"use client";

import React from "react";
import { safeFetch } from "@/lib/http/safeFetch";
import { formatDateTime } from "@/lib/ui/dates";
import { ControlActionButtonV2 } from "@/components/control/v2/ControlActionButtonV2";
import { ControlInputV2 } from "@/components/control/v2/ControlFieldV2";
import ControlBadgeV2, { toneFromStatusV2 } from "@/components/control/v2/ControlBadgeV2";
import { controlV2Theme as t } from "@/components/control/v2/controlV2Theme";
import { ControlTableV2, ControlTableCellV2, ControlTableHeadCellV2, ControlTableWrapV2 } from "@/components/control/v2/ControlTableV2";

type AuditRow = {
  id: string;
  created_at: string;
  actor_email: string | null;
  actor_user_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  meta: Record<string, any> | null;
};

type AuditResp = { ok: true; rows: AuditRow[] } | { ok?: false; error?: string };

export default function ActivityTabV2({ shopId }: { shopId: string }) {
  const [rows, setRows] = React.useState<AuditRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [status, setStatus] = React.useState("");
  const [query, setQuery] = React.useState("");

  async function load() {
    setLoading(true);
    const response = await safeFetch<AuditResp>(`/api/shops/activity?shop_id=${encodeURIComponent(shopId)}&limit=80`, {
      credentials: "include",
      cache: "no-store",
    });
    if (!response.ok || !(response.data as any)?.ok) {
      setStatus(response.ok ? ((response.data as any)?.error ?? "Unable to load activity.") : `${response.status}: ${response.error}`);
      setLoading(false);
      return;
    }
    setRows((response.data as any).rows ?? []);
    setStatus("");
    setLoading(false);
  }

  React.useEffect(() => {
    void load();
  }, [shopId]);

  const filteredRows = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      [row.action, row.actor_email, row.actor_user_id, row.target_type, row.target_id, JSON.stringify(row.meta ?? {})]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    );
  }, [query, rows]);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ color: t.color.textQuiet, ...t.type.label }}>Shop Activity Log</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <ControlInputV2 value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter activity" style={{ minWidth: 220 }} />
          <ControlActionButtonV2 onClick={() => void load()} disabled={loading}>{loading ? "Refreshing..." : "Refresh"}</ControlActionButtonV2>
        </div>
      </div>

      {status ? <div style={{ fontSize: 12.5, color: t.color.textMuted }}>{status}</div> : null}

      <ControlTableWrapV2>
        <ControlTableV2>
          <thead>
            <tr>
              {["Time", "Action", "Actor", "Target", "Severity"].map((heading) => (
                <ControlTableHeadCellV2 key={heading}>{heading}</ControlTableHeadCellV2>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding: 14, color: t.color.textMuted }}>Loading activity...</td></tr>
            ) : filteredRows.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 14, color: t.color.textMuted }}>No matching activity was recorded for this shop yet.</td></tr>
            ) : (
              filteredRows.map((row) => {
                const severity =
                  /failed|error|blocked|restricted/i.test(row.action)
                    ? "Action Needed"
                    : /delete|revoke|disable/i.test(row.action)
                      ? "Warning"
                      : "OK";
                return (
                  <tr key={row.id}>
                    <ControlTableCellV2>{formatDateTime(row.created_at)}</ControlTableCellV2>
                    <ControlTableCellV2><span style={{ fontWeight: 700, color: t.color.text }}>{row.action}</span></ControlTableCellV2>
                    <ControlTableCellV2>{row.actor_email ?? row.actor_user_id ?? "System"}</ControlTableCellV2>
                    <ControlTableCellV2>{row.target_type ?? "event"} {row.target_id ?? ""}</ControlTableCellV2>
                    <ControlTableCellV2><ControlBadgeV2 label={severity} tone={toneFromStatusV2(severity)} /></ControlTableCellV2>
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
