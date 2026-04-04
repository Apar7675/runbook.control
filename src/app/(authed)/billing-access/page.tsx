import React from "react";
import {
  ActionLink,
  EmptyState,
  PageHeader,
  SectionBlock,
  StatusBadge,
  toneFromStatus,
} from "@/components/control/ui";
import { getShopSnapshot, getViewerContext, selectPrimaryShop } from "@/lib/control/summary";
import { formatDateTime } from "@/lib/ui/dates";

export const dynamic = "force-dynamic";

function formatDate(value?: string | null) {
  if (!value) return "Not set";
  try {
    return formatDateTime(value);
  } catch {
    return value;
  }
}

export default async function BillingAccessPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const requestedShopId = typeof params.shop === "string" ? params.shop : "";
  const context = await getViewerContext();
  const primaryShop = selectPrimaryShop(context.shops, requestedShopId);
  const snapshot = primaryShop ? await getShopSnapshot(primaryShop) : null;

  if (!primaryShop || !snapshot) {
    return (
      <div style={{ display: "grid", gap: 20 }}>
        <PageHeader eyebrow="Billing & Access" title="Billing & Access" description="Billing drives real access outcomes across Desktop, Workstation, and Mobile." />
        <EmptyState
          title="No shop available"
          description="Set up a shop first so Control can explain plan state and access impact."
          action={<ActionLink href="/shops" tone="primary">Open Shop Setup</ActionLink>}
        />
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 22 }}>
      <PageHeader
        eyebrow="Billing & Access"
        title={`Billing & Access for ${snapshot.name}`}
        description="This page explains access outcomes in plain English instead of exposing raw Stripe or entitlement mechanics."
        actions={
          <>
            <ActionLink href={`/shops/${snapshot.id}/billing`} tone="primary">Manage Subscription</ActionLink>
            <ActionLink href="/apps">Review App Access</ActionLink>
          </>
        }
      />

      <SectionBlock title="Current Outcome" description="Start with what the current billing state means operationally.">
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <StatusBadge label={snapshot.access.display_status} tone={toneFromStatus(snapshot.access.display_status)} />
            <StatusBadge label={snapshot.access.billing_status} tone={toneFromStatus(snapshot.access.display_status)} />
          </div>
          <div style={{ color: "rgba(230,232,239,0.84)", lineHeight: 1.55 }}>{snapshot.access.summary}</div>
        </div>
      </SectionBlock>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
        <SectionBlock title="Desktop" description="How billing affects Desktop.">
          <div style={{ color: "rgba(230,232,239,0.84)", lineHeight: 1.55 }}>
            {snapshot.access.desktop_mode === "full" ? "Full Access" : "Read-Only"}
          </div>
        </SectionBlock>
        <SectionBlock title="Workstation" description="How billing affects Workstation.">
          <div style={{ color: "rgba(230,232,239,0.84)", lineHeight: 1.55 }}>
            {snapshot.access.workstation_mode === "full" ? "Full Access" : "Blocked"}
          </div>
        </SectionBlock>
        <SectionBlock title="Mobile" description="How billing affects Mobile.">
          <div style={{ color: "rgba(230,232,239,0.84)", lineHeight: 1.55 }}>
            {snapshot.access.mobile_mode === "full" ? "Full Access" : snapshot.access.mobile_mode === "queue_only" ? "Queue-Only" : "Blocked"}
          </div>
        </SectionBlock>
      </div>

      <SectionBlock title="Billing Timeline" description="Show the important dates, not raw backend fields first.">
        <div style={{ display: "grid", gap: 10, color: "rgba(230,232,239,0.84)", lineHeight: 1.55 }}>
          <div>Trial ends: {formatDate(snapshot.trial_ends_at)}</div>
          <div>Current period end: {formatDate(snapshot.billing_current_period_end)}</div>
          <div>Grace ends: {formatDate(snapshot.grace_ends_at)}</div>
        </div>
      </SectionBlock>

      <SectionBlock title="Admin Guidance" description="Keep the actions small, clear, and not duplicated across the app.">
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ color: "rgba(230,232,239,0.84)", lineHeight: 1.55 }}>
            If access looks wrong, first review the billing state here, then confirm the affected app status in Apps, and only then move into device or employee troubleshooting.
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <ActionLink href={`/shops/${snapshot.id}/billing`} tone="primary">Open Billing</ActionLink>
            <ActionLink href="/apps">Review Access Impact</ActionLink>
          </div>
        </div>
      </SectionBlock>
    </div>
  );
}
