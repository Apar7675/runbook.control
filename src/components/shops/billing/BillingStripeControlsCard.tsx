"use client";

import React from "react";
import GlassCard from "@/components/GlassCard";
import { ControlButton } from "@/components/control/ui";
import { theme } from "@/lib/ui/theme";

type BillingSnapshot = {
  shop: {
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    billing_amount?: string | number | null;
    billing_interval?: string | null;
    subscription_plan?: string | null;
  };
};

export default function BillingStripeControlsCard({
  snapshot,
  syncBusy,
  portalBusy,
  checkoutBusy,
  message,
  onSync,
  onOpenPortal,
  onStartCheckout,
}: {
  snapshot: BillingSnapshot | null;
  syncBusy: boolean;
  portalBusy: boolean;
  checkoutBusy: boolean;
  message: string;
  onSync: () => Promise<void>;
  onOpenPortal: () => Promise<void>;
  onStartCheckout: () => Promise<void>;
}) {
  const canOpenPortal = Boolean(snapshot?.shop.stripe_customer_id);
  const canSync = Boolean(snapshot?.shop.stripe_subscription_id);
  const canStartCheckout = !snapshot?.shop.stripe_subscription_id;

  return (
    <GlassCard
      title="Stripe / Subscription Actions"
      subtitle="Only actions with real server wiring are enabled. Unsupported controls stay disabled here on purpose so the page never pretends Stripe was changed when it was not."
    >
      <div style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <div style={{ padding: 14, borderRadius: 18, border: theme.border.muted, background: "rgba(255,255,255,0.03)", display: "grid", gap: 8 }}>
            <div style={{ fontSize: 12, color: theme.text.secondary }}>Current Stripe plan</div>
            <div style={{ fontWeight: 800 }}>{snapshot?.shop.subscription_plan ?? "Not set"}</div>
            <div style={{ fontSize: 12, color: theme.text.quiet }}>
              Stored amount: {snapshot?.shop.billing_amount ?? "Not set"}{snapshot?.shop.billing_interval ? ` / ${snapshot.shop.billing_interval}` : ""}
            </div>
          </div>
          <div style={{ padding: 14, borderRadius: 18, border: theme.border.muted, background: "rgba(255,255,255,0.03)", display: "grid", gap: 8 }}>
            <div style={{ fontSize: 12, color: theme.text.secondary }}>Portal support</div>
            <div style={{ fontWeight: 800 }}>{canOpenPortal ? "Ready" : "Unavailable"}</div>
            <div style={{ fontSize: 12, color: theme.text.quiet }}>
              The billing portal opens only when the shop already has a Stripe customer id on file.
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <ControlButton onClick={() => void onSync()} disabled={syncBusy || !canSync}>
            {syncBusy ? "Syncing..." : "Sync Billing From Stripe"}
          </ControlButton>
          <ControlButton onClick={() => void onOpenPortal()} disabled={portalBusy || !canOpenPortal}>
            {portalBusy ? "Opening..." : "Open Stripe Portal"}
          </ControlButton>
          <ControlButton onClick={() => void onStartCheckout()} disabled={checkoutBusy || !canStartCheckout}>
            {checkoutBusy ? "Starting..." : "Start Stripe Checkout"}
          </ControlButton>
        </div>

        <div style={{ display: "grid", gap: 10, padding: 14, borderRadius: 18, border: theme.border.muted, background: "rgba(255,255,255,0.03)" }}>
          <div style={{ fontSize: 13, fontWeight: 800 }}>Not supported yet</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <ControlButton disabled tone="secondary">Pause Billing</ControlButton>
            <ControlButton disabled tone="secondary">Resume Billing</ControlButton>
            <ControlButton disabled tone="secondary">Set Custom Monthly Amount</ControlButton>
            <ControlButton disabled tone="secondary">Mark Manually Paid</ControlButton>
          </div>
          <div style={{ fontSize: 12, color: theme.text.quiet, lineHeight: 1.6 }}>
            The current backend does not have truthful Stripe mutation support for pause, resume, repricing, or manual-paid bookkeeping. Those stay disabled until the server implementation is real.
          </div>
        </div>

        {message ? <div style={{ fontSize: 13, color: theme.text.secondary }}>{message}</div> : null}
      </div>
    </GlassCard>
  );
}
