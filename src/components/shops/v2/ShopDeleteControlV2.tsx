"use client";

import React from "react";
import { safeFetch } from "@/lib/http/safeFetch";
import { formatDateTime } from "@/lib/ui/dates";
import ControlPanelV2 from "@/components/control/v2/ControlPanelV2";
import { ControlActionButtonV2 } from "@/components/control/v2/ControlActionButtonV2";
import { ControlInputV2 } from "@/components/control/v2/ControlFieldV2";
import ControlBadgeV2, { toneFromStatusV2 } from "@/components/control/v2/ControlBadgeV2";
import { controlV2Theme as t } from "@/components/control/v2/controlV2Theme";

type DeleteLogEntry = {
  at: string;
  step: string;
  level: "info" | "warn" | "error";
  message: string;
};

type DeleteOperation = {
  id: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  result_json: Record<string, any>;
  error_json: Record<string, any> | null;
};

type DeleteOperationResponse = { ok: true; operation: DeleteOperation | null } | { ok?: false; error?: string };
type DeleteResponse = { ok?: boolean; error?: string };

function statusLabel(status: string | null | undefined) {
  const value = String(status ?? "").trim().toLowerCase();
  if (value === "completed") return "OK";
  if (value === "running" || value === "pending") return "Warning";
  if (value === "failed" || value === "partial_failed") return "Action Needed";
  return "Pending";
}

export default function ShopDeleteControlV2({
  shopId,
  shopName,
}: {
  shopId: string;
  shopName: string;
}) {
  const [confirmName, setConfirmName] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [refreshToken, setRefreshToken] = React.useState(0);
  const [operation, setOperation] = React.useState<DeleteOperation | null>(null);

  async function loadOperation() {
    const response = await safeFetch<DeleteOperationResponse>(`/api/shops/delete-operation?shop_id=${encodeURIComponent(shopId)}`, {
      credentials: "include",
      cache: "no-store",
    });
    if (!response.ok || !(response.data as any)?.ok) {
      setLoading(false);
      return;
    }
    setOperation((response.data as any).operation ?? null);
    setLoading(false);
  }

  React.useEffect(() => {
    setLoading(true);
    void loadOperation();
  }, [shopId, refreshToken]);

  React.useEffect(() => {
    if (!operation || operation.status !== "running") return;
    const handle = window.setInterval(() => void loadOperation(), 4000);
    return () => window.clearInterval(handle);
  }, [operation?.id, operation?.status]);

  async function startDelete() {
    if (confirmName.trim() !== shopName) {
      setStatus(`Type "${shopName}" exactly to continue.`);
      return;
    }
    setBusy(true);
    setStatus("");
    const response = await safeFetch<DeleteResponse>("/api/shops/delete", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ shopId, confirmName }),
    });
    if (!response.ok || !response.data?.ok) {
      setStatus(response.ok ? response.data?.error ?? "Delete failed." : `${response.status}: ${response.error}`);
      setBusy(false);
      setRefreshToken((value) => value + 1);
      return;
    }
    setStatus("Delete accepted. Live orchestration status is shown below.");
    setBusy(false);
    setRefreshToken((value) => value + 1);
  }

  const logs = Array.isArray(operation?.result_json?.logs) ? (operation?.result_json.logs as DeleteLogEntry[]) : [];

  return (
    <ControlPanelV2
      title="Danger zone"
      description="Delete stays isolated from normal shop operations. This hits the authoritative server orchestration and the status below reflects the real delete operation record."
    >
      <div id="danger" style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <ControlInputV2 value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder={`Type ${shopName}`} style={{ maxWidth: 260 }} />
          <ControlActionButtonV2 tone="danger" onClick={startDelete} disabled={busy}>{busy ? "Starting..." : "Delete shop"}</ControlActionButtonV2>
        </div>

        {status ? <div style={{ fontSize: 12, color: t.color.textMuted }}>{status}</div> : null}

        <div style={{ display: "grid", gap: 8, borderTop: `1px solid ${t.color.border}`, paddingTop: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ color: t.color.textQuiet, ...t.type.label }}>Delete Status</div>
            <ControlActionButtonV2 onClick={() => { setLoading(true); setRefreshToken((value) => value + 1); }} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </ControlActionButtonV2>
          </div>

          {loading ? (
            <div style={{ fontSize: 12, color: t.color.textMuted }}>Loading delete status...</div>
          ) : !operation ? (
            <div style={{ fontSize: 12, color: t.color.textMuted }}>No delete operation has been recorded for this shop yet.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <ControlBadgeV2 label={operation.status.replace(/_/g, " ")} tone={toneFromStatusV2(statusLabel(operation.status))} />
                {operation.result_json?.phase ? <ControlBadgeV2 label={String(operation.result_json.phase).replace(/_/g, " ")} tone="neutral" /> : null}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10 }}>
                <div style={{ fontSize: 12, color: t.color.textMuted }}>Started: <strong>{operation.started_at ? formatDateTime(operation.started_at) : "Unknown"}</strong></div>
                <div style={{ fontSize: 12, color: t.color.textMuted }}>Completed: <strong>{operation.completed_at ? formatDateTime(operation.completed_at) : "Still running"}</strong></div>
                <div style={{ fontSize: 12, color: t.color.textMuted }}>Operation ID: <strong>{operation.id}</strong></div>
              </div>

              {operation.error_json ? (
                <div style={{ fontSize: 12, color: t.color.danger, lineHeight: 1.5 }}>
                  Error: {String(operation.error_json?.message ?? "Delete operation failed.")}
                </div>
              ) : null}

              {logs.length > 0 ? (
                <div style={{ display: "grid", gap: 6 }}>
                  {logs.slice(-4).reverse().map((entry, index) => (
                    <div key={`${entry.at}:${index}`} style={{ display: "grid", gap: 4, paddingTop: 6, borderTop: `1px solid ${t.color.border}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                          <ControlBadgeV2 label={entry.level} tone={entry.level === "error" ? "danger" : entry.level === "warn" ? "warning" : "neutral"} />
                          <span style={{ fontSize: 12, fontWeight: 700 }}>{entry.step}</span>
                        </div>
                        <span style={{ fontSize: 11, color: t.color.textQuiet }}>{entry.at ? formatDateTime(entry.at) : ""}</span>
                      </div>
                      <div style={{ fontSize: 12, color: t.color.textMuted, lineHeight: 1.45 }}>{entry.message}</div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </ControlPanelV2>
  );
}
