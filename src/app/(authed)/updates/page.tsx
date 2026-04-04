import React from "react";
import { ActionLink, EmptyState, PageHeader, SectionBlock, StatusBadge, toneFromStatus } from "@/components/control/ui";
import { getShopSnapshot, getViewerContext, selectPrimaryShop } from "@/lib/control/summary";

export const dynamic = "force-dynamic";

function formatPolicySummary(snapshot: Awaited<ReturnType<typeof getShopSnapshot>>) {
  const hasOffline = snapshot.health.offline_devices > 0;
  if (hasOffline) return "Some devices are offline, so update readiness needs review before rollout.";
  if (snapshot.counts.devices_total === 0) return "No devices are registered yet, so no rollout policy is needed yet.";
  return "Devices are connected well enough to review rollout policy and update readiness.";
}

export default async function UpdatesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const requestedShopId = typeof params.shop === "string" ? params.shop : "";
  const context = await getViewerContext();
  const primaryShop = selectPrimaryShop(context.shops, requestedShopId);

  if (!primaryShop) {
    return (
      <div style={{ display: "grid", gap: 20 }}>
        <PageHeader eyebrow="Updates" title="Updates" description="Review rollout policy once a shop and devices exist." />
        <EmptyState
          title="No shop available"
          description="Set up a shop and register devices before managing rollout policy."
          action={<ActionLink href="/shops" tone="primary">Open Shop Setup</ActionLink>}
        />
      </div>
    );
  }

  const snapshot = await getShopSnapshot(primaryShop);
  const readiness = snapshot.health.offline_devices > 0 ? "Warning" : snapshot.counts.devices_total === 0 ? "Pending" : "Healthy";

  return (
    <div style={{ display: "grid", gap: 22 }}>
      <PageHeader
        eyebrow="Updates"
        title={`Updates for ${snapshot.name}`}
        description="Present rollout policy as an operational choice, not a table-driven backend setting."
        actions={
          <>
            <ActionLink href={`/shops/${snapshot.id}/policy`} tone="primary">Change Rollout Policy</ActionLink>
            <ActionLink href="/devices">Review Device Status</ActionLink>
          </>
        }
      />

      <SectionBlock title="Update Readiness" description="Help the admin know if rollout review is safe to do right now.">
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <StatusBadge label={readiness} tone={toneFromStatus(readiness)} />
          </div>
          <div style={{ color: "rgba(230,232,239,0.84)", lineHeight: 1.55 }}>{formatPolicySummary(snapshot)}</div>
        </div>
      </SectionBlock>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
        <SectionBlock title="Connected Devices" description="Devices that could receive updates.">
          <div style={{ fontSize: 34, fontWeight: 900 }}>{snapshot.counts.devices_total}</div>
          <div style={{ color: "rgba(230,232,239,0.82)" }}>{snapshot.counts.devices_active} active right now.</div>
        </SectionBlock>
        <SectionBlock title="Offline Devices" description="Devices that need review before rollout confidence is high.">
          <div style={{ fontSize: 34, fontWeight: 900 }}>{snapshot.health.offline_devices}</div>
          <div style={{ color: "rgba(230,232,239,0.82)" }}>{snapshot.health.stale_devices} additional devices are stale.</div>
        </SectionBlock>
      </div>

      <SectionBlock
        title="Next Step"
        description="The detailed editor still lives in the existing shop policy page so current behavior stays intact."
      >
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ color: "rgba(230,232,239,0.84)", lineHeight: 1.55 }}>
            Use the shop policy page to set rollout channel and version gates. This summary page keeps the explanation simple and directs the admin into the right workflow.
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <ActionLink href={`/shops/${snapshot.id}/policy`} tone="primary">Open Update Policy</ActionLink>
            <ActionLink href="/devices">Review Devices</ActionLink>
          </div>
        </div>
      </SectionBlock>
    </div>
  );
}
