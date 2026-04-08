import React from "react";
import { ActionLink, EmptyState, KeyValueGrid, NoteList, PageHeader, SectionBlock, StatusBadge, toneFromStatus } from "@/components/control/ui";
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
      <div className="rb-page">
        <PageHeader eyebrow="Billing & Access" title="Billing & Access" description="Billing drives real access outcomes across Desktop, Workstation, and Mobile." />
        <EmptyState title="No shop available" description="Set up a shop first so Control can explain plan state and access impact." action={<ActionLink href="/shops" tone="primary">Open Shop Setup</ActionLink>} />
      </div>
    );
  }

  return (
    <div className="rb-page">
      <PageHeader
        eyebrow="Billing & Access"
        title={`Billing & Access for ${snapshot.name}`}
        description="This page explains access outcomes in plain language instead of exposing raw Stripe or entitlement mechanics."
        actions={<><ActionLink href={`/shops/${snapshot.id}/billing`} tone="primary">Manage Subscription</ActionLink><ActionLink href="/apps">Review App Access</ActionLink></>}
      />

      <SectionBlock title="Current Outcome" description="Start with what the current billing state means operationally.">
        <div className="rb-stack">
          <div className="rb-chipRow">
            <StatusBadge label={snapshot.access.display_status} tone={toneFromStatus(snapshot.access.display_status)} />
            <StatusBadge label={snapshot.access.billing_status ?? "Unknown"} tone={toneFromStatus(snapshot.access.display_status)} />
          </div>
          <div className="rb-pageCopy">{snapshot.access.summary}</div>
          <KeyValueGrid
            items={[
              { label: "Desktop", value: snapshot.access.desktop_mode === "full" ? "Full Access" : "Read-Only" },
              { label: "Workstation", value: snapshot.access.workstation_mode === "full" ? "Full Access" : "Blocked" },
              { label: "Mobile", value: snapshot.access.mobile_mode === "full" ? "Full Access" : snapshot.access.mobile_mode === "queue_only" ? "Queue-Only" : "Blocked" },
            ]}
          />
        </div>
      </SectionBlock>

      <SectionBlock title="Billing Timeline" description="Show the dates that actually matter before anything deeper.">
        <KeyValueGrid
          items={[
            { label: "Trial Ends", value: formatDate(snapshot.trial_ends_at) },
            { label: "Current Period End", value: formatDate(snapshot.billing_current_period_end) },
            { label: "Grace Ends", value: formatDate(snapshot.grace_ends_at) },
          ]}
        />
      </SectionBlock>

      <SectionBlock title="Admin Guidance" description="Keep the actions small, clear, and not duplicated across the app.">
        <NoteList
          items={[
            "If access looks wrong, review billing here before investigating devices or employees.",
            "Use Apps next to see which product surfaces are restricted by the current state.",
            "Move into the shop billing workspace only when you need Stripe-level management actions.",
          ]}
        />
        <div className="rb-inlineRow">
          <ActionLink href={`/shops/${snapshot.id}/billing`} tone="primary">Open Billing</ActionLink>
          <ActionLink href="/apps">Review Access Impact</ActionLink>
        </div>
      </SectionBlock>
    </div>
  );
}
