"use client";

import React from "react";
import GlassCard from "@/components/GlassCard";
import { ControlButton, DataList, MetricCard, StatusBadge, toneFromStatus } from "@/components/control/ui";
import { formatDateTime } from "@/lib/ui/dates";

type BillingSnapshot = {
  shop: {
    billing_status: string | null;
    trial_started_at?: string | null;
    trial_ends_at?: string | null;
    billing_current_period_end: string | null;
    billing_amount?: string | number | null;
    billing_interval?: string | null;
    manual_billing_status?: string | null;
    grace_ends_at?: string | null;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    subscription_plan?: string | null;
    entitlement_override?: string | null;
    manual_billing_override?: boolean | null;
  };
  entitlement: {
    status: string;
    allowed: boolean;
    restricted: boolean;
    reason: string;
    grace_active: boolean;
  };
  access: {
    display_status: string;
    summary: string;
    desktop_mode: string;
    mobile_mode: string;
    workstation_mode: string;
  };
};

function fmt(value: string | null | undefined) {
  if (!value) return "Not set";
  try {
    return formatDateTime(value);
  } catch {
    return value;
  }
}

function moneyLabel(amount: string | number | null | undefined, interval: string | null | undefined) {
  if (amount === null || amount === undefined || String(amount).trim() === "") return "Not set";
  const suffix = interval ? ` / ${interval}` : "";
  return `$${amount}${suffix}`;
}

function trialLabel(snapshot: BillingSnapshot) {
  const manual = Boolean(snapshot.shop.manual_billing_override);
  const manualStatus = String(snapshot.shop.manual_billing_status ?? "").trim();
  if (manual && manualStatus) return `Manual ${manualStatus.replaceAll("_", " ")}`;
  if (snapshot.shop.trial_ends_at) return "Date-based trial";
  return "No trial override";
}

export default function BillingSummaryCard({
  snapshot,
  loading,
  onRefresh,
}: {
  snapshot: BillingSnapshot | null;
  loading: boolean;
  onRefresh: () => Promise<void>;
}) {
  const [showStripeDetails, setShowStripeDetails] = React.useState(false);

  if (!snapshot) {
    return (
      <GlassCard title="Current Billing State" subtitle="Loading the real shop billing state from Control.">
        <div style={{ opacity: 0.78, fontSize: 13 }}>Loading billing summary...</div>
      </GlassCard>
    );
  }

  const accessTone = toneFromStatus(snapshot.access.display_status);
  const billingTone = toneFromStatus(snapshot.shop.billing_status ?? "restricted");
  const trialTone = toneFromStatus(snapshot.shop.trial_ends_at ? "healthy" : "warning");
  const overrideTone = snapshot.shop.manual_billing_override || snapshot.shop.entitlement_override ? "warning" : "neutral";

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        <MetricCard
          title="Access Status"
          value={snapshot.access.display_status}
          summary={snapshot.access.summary}
          badge={<StatusBadge label={snapshot.access.display_status} tone={accessTone} />}
          tone={accessTone === "critical" ? "critical" : accessTone === "warning" ? "warning" : "healthy"}
          icon="access"
        />
        <MetricCard
          title="Billing Lifecycle"
          value={snapshot.shop.billing_status ?? "unknown"}
          summary={`Entitlement engine is currently evaluating this shop as ${snapshot.entitlement.status}.`}
          badge={<StatusBadge label={snapshot.entitlement.status} tone={billingTone} />}
          tone={billingTone === "critical" ? "critical" : billingTone === "warning" ? "warning" : "subtle"}
          icon="billing"
        />
        <MetricCard
          title="Trial Window"
          value={trialLabel(snapshot)}
          summary={snapshot.shop.trial_ends_at ? `Ends ${fmt(snapshot.shop.trial_ends_at)}` : "No trial end is currently stored."}
          badge={<StatusBadge label={snapshot.shop.trial_ends_at ? "tracked" : "not set"} tone={trialTone} />}
          tone={trialTone === "warning" ? "warning" : "subtle"}
          icon="spark"
        />
        <MetricCard
          title="Monthly Amount"
          value={moneyLabel(snapshot.shop.billing_amount, snapshot.shop.billing_interval)}
          summary={snapshot.shop.subscription_plan ? "Stored from the current Stripe price when available." : "No Stripe subscription plan is currently on file."}
          badge={<StatusBadge label={snapshot.shop.manual_billing_override || snapshot.shop.entitlement_override ? "override active" : "normal logic"} tone={overrideTone} />}
          tone={overrideTone === "warning" ? "warning" : "subtle"}
          icon="settings"
        />
      </div>

      <GlassCard
        title="Current Billing and Access Summary"
        subtitle="This is the live Control view of billing, entitlement, and access for this shop. Access overrides and Stripe-backed actions stay separate below."
        actions={
          <>
            <ControlButton onClick={() => void onRefresh()} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </ControlButton>
            <ControlButton onClick={() => setShowStripeDetails((current) => !current)}>
              {showStripeDetails ? "Hide Stripe Details" : "Show Stripe Details"}
            </ControlButton>
          </>
        }
      >
        <DataList
          items={[
            { label: "Current Plan", value: snapshot.shop.subscription_plan ?? "No plan stored yet" },
            { label: "Subscription Status", value: snapshot.shop.billing_status ?? "Unknown" },
            { label: "Billing Status", value: snapshot.entitlement.status },
            { label: "Entitlement / Access", value: snapshot.access.display_status },
            { label: "Trial Status", value: trialLabel(snapshot) },
            { label: "Trial Started", value: fmt(snapshot.shop.trial_started_at) },
            { label: "Trial End", value: fmt(snapshot.shop.trial_ends_at) },
            { label: "Current Billing Period End", value: fmt(snapshot.shop.billing_current_period_end) },
            { label: "Grace End", value: fmt(snapshot.shop.grace_ends_at) },
            {
              label: "Manual Override Status",
              value: snapshot.shop.manual_billing_override
                ? snapshot.shop.manual_billing_status ?? "Enabled"
                : "No manual billing override",
            },
            {
              label: "Entitlement Override",
              value: snapshot.shop.entitlement_override ?? "Normal logic",
            },
            {
              label: "Monthly Amount",
              value: moneyLabel(snapshot.shop.billing_amount, snapshot.shop.billing_interval),
            },
            { label: "Desktop Access", value: snapshot.access.desktop_mode },
            { label: "Mobile Access", value: snapshot.access.mobile_mode },
            { label: "Workstation Access", value: snapshot.access.workstation_mode },
          ]}
        />

        {showStripeDetails ? (
          <div style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid rgba(255,255,255,0.08)", display: "grid", gap: 10, fontSize: 13 }}>
            <div>Stripe customer: <strong>{snapshot.shop.stripe_customer_id ?? "Not set"}</strong></div>
            <div>Stripe subscription: <strong>{snapshot.shop.stripe_subscription_id ?? "Not set"}</strong></div>
          </div>
        ) : null}
      </GlassCard>
    </div>
  );
}
