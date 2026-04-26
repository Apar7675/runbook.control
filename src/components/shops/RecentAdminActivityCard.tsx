"use client";

import React from "react";
import GlassCard from "@/components/GlassCard";
import { ActionLink, ControlButton, StatusBadge, toneFromStatus } from "@/components/control/ui";
import { safeFetch } from "@/lib/http/safeFetch";
import { formatDateTime } from "@/lib/ui/dates";
import { theme } from "@/lib/ui/theme";

type ActivityRow = {
  id: string;
  created_at: string;
  actor_user_id: string | null;
  actor_email: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  meta: Record<string, unknown> | null;
};

type ActivityResponse = { ok: true; rows: ActivityRow[] };

export default function RecentAdminActivityCard({
  shopId,
}: {
  shopId: string;
}) {
  const [rows, setRows] = React.useState<ActivityRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [status, setStatus] = React.useState("");

  async function loadActivity() {
    setLoading(true);
    const response = await safeFetch<ActivityResponse>(`/api/shops/activity?shop_id=${encodeURIComponent(shopId)}&limit=6`, {
      credentials: "include",
      cache: "no-store",
    });

    if (!response.ok || !(response.data as any)?.ok) {
      setStatus(response.ok ? (response.data as any)?.error ?? "Could not load activity." : `${response.status}: ${response.error}`);
      setLoading(false);
      return;
    }

    setRows(response.data.rows ?? []);
    setStatus("");
    setLoading(false);
  }

  React.useEffect(() => {
    loadActivity();
  }, [shopId]);

  return (
    <GlassCard
      title="Recent Admin Activity"
      subtitle="Recent shop-scoped admin events from the real audit log."
      actions={<ControlButton onClick={loadActivity} disabled={loading}>{loading ? "Refreshing..." : "Refresh"}</ControlButton>}
      tone="subtle"
    >
      {status ? (
        <div style={{ color: theme.text.secondary, fontSize: 13, lineHeight: 1.58 }}>{status}</div>
      ) : loading ? (
        <div style={{ color: theme.text.secondary, fontSize: 13, lineHeight: 1.58 }}>Loading activity...</div>
      ) : rows.length === 0 ? (
        <div style={{ color: theme.text.secondary, fontSize: 13, lineHeight: 1.58 }}>No recent admin activity has been recorded for this shop yet.</div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {rows.map((row) => {
            const severity =
              /failed|error|blocked|restricted/i.test(row.action)
                ? "Action Needed"
                : /delete|revoke|disable/i.test(row.action)
                  ? "Warning"
                  : "Healthy";

            return (
              <div
                key={row.id}
                style={{
                  display: "grid",
                  gap: 8,
                  padding: 14,
                  borderRadius: 16,
                  border: theme.border.muted,
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>{row.action}</div>
                    <StatusBadge label={severity} tone={toneFromStatus(severity)} />
                  </div>
                  <div style={{ color: theme.text.quiet, fontSize: 12 }}>{formatDateTime(row.created_at)}</div>
                </div>
                <div style={{ color: theme.text.secondary, fontSize: 12.5, lineHeight: 1.55 }}>
                  Actor: <strong>{row.actor_email ?? row.actor_user_id ?? "System"}</strong>
                  {" | "}
                  Target: <strong>{row.target_type ?? "event"} {row.target_id ?? ""}</strong>
                </div>
              </div>
            );
          })}
          <ActionLink href={`/shops/${shopId}/audit`}>Open Full Activity</ActionLink>
        </div>
      )}
    </GlassCard>
  );
}
