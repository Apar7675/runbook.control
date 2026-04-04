import React from "react";
import { ActionLink, EmptyState, PageHeader, SectionBlock, StatusBadge, toneFromStatus } from "@/components/control/ui";
import { getShopSnapshot, getViewerContext, selectPrimaryShop } from "@/lib/control/summary";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ shopId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ShopDevicesPage({ params, searchParams }: Props) {
  const { shopId } = await params;
  const query = (await searchParams) ?? {};
  const returnTo = typeof query.return_to === "string" ? query.return_to : "";
  const context = await getViewerContext();
  const shop = selectPrimaryShop(context.shops, shopId);

  if (!shop) {
    return (
      <div style={{ display: "grid", gap: 20 }}>
        <PageHeader eyebrow="Devices" title="Shop Devices" description="The requested shop is not available to this account." actions={returnTo ? <ActionLink href={returnTo}>Return to Setup</ActionLink> : undefined} />
        <EmptyState title="Shop not available" description="Return to the shop list and select another workspace." action={<ActionLink href="/shops" tone="primary">Back to Shops</ActionLink>} />
      </div>
    );
  }

  const snapshot = await getShopSnapshot(shop);
  const health = snapshot.health.offline_devices > 0 ? "Action Needed" : snapshot.health.stale_devices > 0 ? "Warning" : "Healthy";

  return (
    <div style={{ display: "grid", gap: 22 }}>
      <PageHeader
        eyebrow="Devices"
        title={`Devices for ${snapshot.name}`}
        description="Keep device review simple: how many are active, how many need attention, and where to go next."
        actions={
          <>
            {returnTo ? <ActionLink href={returnTo}>Return to Setup</ActionLink> : null}
            <ActionLink href="/devices" tone="primary">Open Device Center</ActionLink>
            <ActionLink href={`/shops/${snapshot.id}/audit`}>Review Activity</ActionLink>
          </>
        }
      />

      <SectionBlock title="Health Summary" description="A novice admin should not have to parse raw device records first.">
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <StatusBadge label={health} tone={toneFromStatus(health)} />
          </div>
          <div style={{ color: "rgba(230,232,239,0.82)", lineHeight: 1.5 }}>
            {snapshot.counts.devices_active} active devices, {snapshot.health.stale_devices} stale devices, and {snapshot.health.offline_devices} offline devices.
          </div>
        </div>
      </SectionBlock>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        <SectionBlock title="Desktop" description="Desktop devices connected to this shop.">
          <div style={{ fontSize: 34, fontWeight: 900 }}>{snapshot.counts.desktops_active}</div>
          <div style={{ color: "rgba(230,232,239,0.82)" }}>Active desktops of {snapshot.counts.desktops_total} total.</div>
        </SectionBlock>
        <SectionBlock title="Workstation" description="Workstation devices connected to this shop.">
          <div style={{ fontSize: 34, fontWeight: 900 }}>{snapshot.counts.workstations_active}</div>
          <div style={{ color: "rgba(230,232,239,0.82)" }}>Active workstations of {snapshot.counts.workstations_total} total.</div>
        </SectionBlock>
      </div>

      <SectionBlock title="Next Step" description="Advanced device actions still live in the main Device Center so working behavior stays unchanged.">
        <div style={{ color: "rgba(230,232,239,0.82)", lineHeight: 1.55 }}>
          Use the Device Center for device registration, activation, and health review. This shop page keeps the explanation brief while still showing whether anything needs attention.
        </div>
      </SectionBlock>
    </div>
  );
}
