"use client";

import React from "react";
import GlassCard from "@/components/GlassCard";
import { ControlButton, StatusBadge, toneFromStatus } from "@/components/control/ui";
import { safeFetch } from "@/lib/http/safeFetch";
import { formatDateTime } from "@/lib/ui/dates";
import { theme } from "@/lib/ui/theme";

type DeleteLogEntry = {
  at: string;
  step: string;
  level: "info" | "warn" | "error";
  message: string;
  meta?: Record<string, unknown>;
};

type DeleteOperation = {
  id: string;
  status: string;
  shop_id: string | null;
  shop_name: string | null;
  started_at: string | null;
  completed_at: string | null;
  result_json: Record<string, any>;
  error_json: Record<string, any> | null;
};

type DeleteOperationResponse = { ok: true; operation: DeleteOperation | null };

function statusLabel(status: string | null | undefined) {
  const value = String(status ?? "").trim().toLowerCase();
  if (value === "completed") return "Healthy";
  if (value === "running" || value === "pending") return "Warning";
  if (value === "failed" || value === "partial_failed") return "Action Needed";
  return "Pending";
}

export default function DeleteOperationStatusCard({
  shopId,
  refreshToken = 0,
}: {
  shopId: string;
  refreshToken?: number;
}) {
  const [loading, setLoading] = React.useState(true);
  const [status, setStatus] = React.useState("");
  const [operation, setOperation] = React.useState<DeleteOperation | null>(null);

  async function loadOperation() {
    const response = await safeFetch<DeleteOperationResponse>(`/api/shops/delete-operation?shop_id=${encodeURIComponent(shopId)}`, {
      credentials: "include",
      cache: "no-store",
    });

    if (!response.ok || !(response.data as any)?.ok) {
      setStatus(response.ok ? (response.data as any)?.error ?? "Could not load delete status." : `${response.status}: ${response.error}`);
      setLoading(false);
      return;
    }

    setOperation(response.data.operation ?? null);
    setStatus("");
    setLoading(false);
  }

  React.useEffect(() => {
    setLoading(true);
    loadOperation();
  }, [shopId, refreshToken]);

  React.useEffect(() => {
    if (!operation || operation.status !== "running") return;
    const handle = window.setInterval(() => {
      loadOperation();
    }, 4000);
    return () => window.clearInterval(handle);
  }, [operation?.id, operation?.status]);

  const logs = Array.isArray(operation?.result_json?.logs) ? (operation?.result_json?.logs as DeleteLogEntry[]) : [];
  const visibleLogs = logs.slice(-5).reverse();

  return (
    <GlassCard
      title="Delete Operation Status"
      subtitle="Live status from the real delete-operation record. This reflects actual orchestration state, not a fake success toast."
      tone={!operation ? "subtle" : operation.status === "completed" ? "healthy" : operation.status === "running" ? "warning" : "critical"}
      actions={<ControlButton onClick={loadOperation} disabled={loading}>{loading ? "Refreshing..." : "Refresh"}</ControlButton>}
    >
      {status ? (
        <div style={{ color: theme.text.secondary, fontSize: 13, lineHeight: 1.58 }}>{status}</div>
      ) : loading ? (
        <div style={{ color: theme.text.secondary, fontSize: 13, lineHeight: 1.58 }}>Loading delete status...</div>
      ) : !operation ? (
        <div style={{ color: theme.text.secondary, fontSize: 13, lineHeight: 1.58 }}>
          No shop delete operation has been recorded for this shop yet.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <StatusBadge label={operation.status.replace(/_/g, " ")} tone={toneFromStatus(statusLabel(operation.status))} />
            {operation.result_json?.phase ? <StatusBadge label={String(operation.result_json.phase).replace(/_/g, " ")} tone="neutral" /> : null}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <div style={{ color: theme.text.secondary, fontSize: 12.5 }}>Started: <strong>{operation.started_at ? formatDateTime(operation.started_at) : "Unknown"}</strong></div>
            <div style={{ color: theme.text.secondary, fontSize: 12.5 }}>Completed: <strong>{operation.completed_at ? formatDateTime(operation.completed_at) : "Still running"}</strong></div>
            <div style={{ color: theme.text.secondary, fontSize: 12.5 }}>Operation ID: <strong>{operation.id}</strong></div>
          </div>

          {operation.error_json ? (
            <div style={{ padding: 14, borderRadius: 16, border: theme.border.critical, background: theme.bg.panelCritical, color: theme.text.secondary, fontSize: 12.5, lineHeight: 1.58 }}>
              <strong>Error:</strong> {String(operation.error_json?.message ?? "Delete operation failed.")}
            </div>
          ) : null}

          {visibleLogs.length > 0 ? (
            <div style={{ display: "grid", gap: 10 }}>
              {visibleLogs.map((entry, index) => (
                <div
                  key={`${entry.at}:${index}`}
                  style={{
                    display: "grid",
                    gap: 6,
                    padding: 12,
                    borderRadius: 14,
                    border: theme.border.muted,
                    background: "rgba(255,255,255,0.03)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <StatusBadge label={entry.level} tone={entry.level === "error" ? "critical" : entry.level === "warn" ? "warning" : "neutral"} />
                      <span style={{ fontWeight: 800, fontSize: 13 }}>{entry.step}</span>
                    </div>
                    <span style={{ color: theme.text.quiet, fontSize: 12 }}>{entry.at ? formatDateTime(entry.at) : ""}</span>
                  </div>
                  <div style={{ color: theme.text.secondary, fontSize: 12.5, lineHeight: 1.55 }}>{entry.message}</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </GlassCard>
  );
}
