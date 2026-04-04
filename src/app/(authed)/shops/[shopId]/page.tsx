import React from "react";
import {
  ActionLink,
  DataList,
  EmptyState,
  PageHeader,
  SectionBlock,
  StatusBadge,
  toneFromStatus,
} from "@/components/control/ui";
import { getShopSnapshot, getViewerContext, selectPrimaryShop } from "@/lib/control/summary";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ shopId: string }>;
};

export default async function ShopPage({ params }: Props) {
  const { shopId } = await params;
  const context = await getViewerContext();
  const shop = selectPrimaryShop(context.shops, shopId);

  if (!shop) {
    return (
      <div style={{ display: "grid", gap: 20 }}>
        <PageHeader eyebrow="Shop" title="Shop Overview" description="The requested shop was not found or is no longer available to this account." />
        <EmptyState title="Shop not available" description="Return to the shop list and choose a different workspace." action={<ActionLink href="/shops" tone="primary">Back to Shops</ActionLink>} />
      </div>
    );
  }

  const snapshot = await getShopSnapshot(shop);

  return (
    <div style={{ display: "grid", gap: 22 }}>
      <PageHeader
        eyebrow="Shop"
        title={snapshot.name}
        description="This workspace leads with what the admin needs to know now: access, setup progress, and operational health."
        actions={
          <>
            <ActionLink href={`/shops/${snapshot.id}/billing`} tone="primary">Billing & Access</ActionLink>
            <ActionLink href={`/shops/${snapshot.id}/devices`}>Review Devices</ActionLink>
            <ActionLink href={`/shops/${snapshot.id}/audit`}>Review Activity</ActionLink>
          </>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        <SectionBlock title="Access" description="Current access outcome for the shop.">
          <div style={{ display: "grid", gap: 10 }}>
            <StatusBadge label={snapshot.access.display_status} tone={toneFromStatus(snapshot.access.display_status)} />
            <div style={{ color: "rgba(230,232,239,0.82)", lineHeight: 1.5 }}>{snapshot.access.summary}</div>
          </div>
        </SectionBlock>
        <SectionBlock title="People" description="Who is active and ready.">
          <div style={{ fontSize: 34, fontWeight: 900 }}>{snapshot.counts.employees_active}</div>
          <div style={{ color: "rgba(230,232,239,0.82)" }}>Active employees of {snapshot.counts.employees_total} total.</div>
        </SectionBlock>
        <SectionBlock title="Devices" description="Connected devices for this shop.">
          <div style={{ fontSize: 34, fontWeight: 900 }}>{snapshot.counts.devices_active}</div>
          <div style={{ color: "rgba(230,232,239,0.82)" }}>Active devices of {snapshot.counts.devices_total} total.</div>
        </SectionBlock>
        <SectionBlock title="Attention" description="Items that need review.">
          <div style={{ fontSize: 34, fontWeight: 900 }}>{snapshot.health.offline_devices + snapshot.health.stale_devices}</div>
          <div style={{ color: "rgba(230,232,239,0.82)" }}>{snapshot.health.offline_devices} offline and {snapshot.health.stale_devices} stale devices.</div>
        </SectionBlock>
      </div>

      <SectionBlock title="Shop Summary" description="Replace raw record dumps with an admin-friendly summary.">
        <DataList
          items={[
            { label: "Role", value: snapshot.member_role },
            { label: "Desktop Access", value: snapshot.access.desktop_mode === "full" ? "Full Access" : "Read-Only" },
            { label: "Workstation Access", value: snapshot.access.workstation_mode === "full" ? "Available" : "Blocked" },
            { label: "Mobile Access", value: snapshot.access.mobile_mode === "full" ? "Full Access" : snapshot.access.mobile_mode === "queue_only" ? "Queue-Only" : "Blocked" },
            { label: "Mobile Ready Employees", value: snapshot.counts.employees_mobile_ready },
            { label: "Workstation Ready Employees", value: snapshot.counts.employees_workstation_ready },
          ]}
        />
      </SectionBlock>

      <SectionBlock title="Suggested Next Steps" description="Keep the setup sequence simple and guided.">
        <div style={{ display: "grid", gap: 10, color: "rgba(230,232,239,0.82)", lineHeight: 1.5 }}>
          <div>1. Confirm billing and access are in the expected state.</div>
          <div>2. Register or review devices for Desktop and Workstation.</div>
          <div>3. Review which employees are ready for Mobile and Workstation.</div>
          <div>4. Check recent activity before troubleshooting anything deeper.</div>
        </div>
      </SectionBlock>
    </div>
  );
}
