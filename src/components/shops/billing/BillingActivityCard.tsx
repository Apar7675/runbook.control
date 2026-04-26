"use client";

import React from "react";
import GlassCard from "@/components/GlassCard";
import { ControlButton } from "@/components/control/ui";
import { formatDateTime } from "@/lib/ui/dates";
import { theme } from "@/lib/ui/theme";

type BillingActivityRow = {
  id: string;
  created_at: string;
  actor_email: string | null;
  action: string;
  meta: Record<string, any>;
};

function describeAction(row: BillingActivityRow) {
  const meta = row.meta ?? {};

  if (row.action === "billing.access.trial_extended") {
    const days = meta.days ? `${meta.days} days` : "custom window";
    const next = meta.next_trial_ends_at ? `to ${formatDateTime(meta.next_trial_ends_at)}` : "";
    return `Extended trial access by ${days} ${next}`.trim();
  }

  if (row.action === "billing.access.grace_extended") {
    const days = meta.days ? `${meta.days} days` : "custom window";
    const next = meta.next_grace_ends_at ? `to ${formatDateTime(meta.next_grace_ends_at)}` : "";
    return `Extended grace by ${days} ${next}`.trim();
  }

  if (row.action === "billing.access.entitlement_override_set") {
    return `Changed entitlement override to ${meta.next_override ?? "normal logic"}`;
  }

  if (row.action === "billing.access.override_cleared") {
    return "Cleared manual billing and entitlement overrides";
  }

  if (row.action === "billing.stripe.synced") {
    return `Synced Stripe state${meta.billing_status ? ` (${meta.billing_status})` : ""}`;
  }

  if (row.action === "billing.stripe.sync_failed") {
    return "Stripe sync failed";
  }

  if (row.action === "billing.access.update_failed") {
    return "Access override update failed";
  }

  if (row.action === "billing.override.updated") {
    const count = Array.isArray(meta.changed_fields) ? meta.changed_fields.length : 0;
    return `Updated legacy billing override fields${count ? ` (${count} fields)` : ""}`;
  }

  return row.action.replaceAll(".", " ");
}

function describeNote(row: BillingActivityRow) {
  const meta = row.meta ?? {};
  return String(meta.note ?? meta.trial_override_reason ?? meta.billing_notes ?? meta.error ?? "").trim();
}

export default function BillingActivityCard({
  rows,
  loading,
  onRefresh,
}: {
  rows: BillingActivityRow[];
  loading: boolean;
  onRefresh: () => Promise<void>;
}) {
  return (
    <GlassCard
      title="Billing and Admin Activity"
      subtitle="This feed is backed by real audit entries for billing support work on this shop."
      actions={
        <ControlButton onClick={() => void onRefresh()} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh Activity"}
        </ControlButton>
      }
    >
      {loading && rows.length === 0 ? (
        <div style={{ fontSize: 13, color: theme.text.secondary }}>Loading billing activity...</div>
      ) : rows.length === 0 ? (
        <div style={{ fontSize: 13, color: theme.text.secondary }}>No billing activity is recorded for this shop yet.</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {rows.map((row) => (
            <div
              key={row.id}
              style={{
                display: "grid",
                gap: 6,
                padding: 14,
                borderRadius: 18,
                border: theme.border.muted,
                background: "rgba(255,255,255,0.03)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ fontWeight: 800 }}>{describeAction(row)}</div>
                <div style={{ fontSize: 12, color: theme.text.quiet }}>{formatDateTime(row.created_at)}</div>
              </div>
              <div style={{ fontSize: 12.5, color: theme.text.secondary }}>
                {row.actor_email ?? "Unknown actor"}
              </div>
              {describeNote(row) ? (
                <div style={{ fontSize: 12.5, color: theme.text.secondary, lineHeight: 1.6 }}>
                  {describeNote(row)}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
}
