import React from "react";
import { ActionLink, DataList, EmptyState, NoteList, PageHeader, SectionBlock, StatCallout, StatusBadge, toneFromStatus } from "@/components/control/ui";
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
      <div className="rb-page">
        <PageHeader eyebrow="Shop" title="Shop Overview" description="The requested shop was not found or is no longer available to this account." />
        <EmptyState title="Shop not available" description="Return to the shop list and choose a different workspace." action={<ActionLink href="/shops" tone="primary">Back to Shops</ActionLink>} />
      </div>
    );
  }

  const snapshot = await getShopSnapshot(shop);

  return (
    <div className="rb-page">
      <PageHeader
        eyebrow="Shop"
        title={snapshot.name}
        description="Lead with shop identity, billing posture, readiness, and operational health before deeper admin detail."
        actions={<><ActionLink href={`/shops/${snapshot.id}/billing`} tone="primary">Billing & Access</ActionLink><ActionLink href={`/shops/${snapshot.id}/devices`}>Review Devices</ActionLink><ActionLink href={`/shops/${snapshot.id}/audit`}>Review Activity</ActionLink></>}
      />

      <SectionBlock title="Shop Status" description="The top line should read like a control surface, not a raw record screen.">
        <div className="rb-rowBetween">
          <div className="rb-stack" style={{ gap: 10 }}>
            <div className="rb-chipRow">
              <StatusBadge label={snapshot.access.display_status} tone={toneFromStatus(snapshot.access.display_status)} />
              <StatusBadge label={snapshot.member_role} tone="neutral" />
            </div>
            <div className="rb-pageCopy">{snapshot.access.summary}</div>
          </div>
          <div className="rb-inlineRow">
            <ActionLink href={`/shops/${snapshot.id}/billing`} tone="primary">Open Subscription</ActionLink>
            <ActionLink href={`/shops/${snapshot.id}/devices`}>Device Health</ActionLink>
          </div>
        </div>
      </SectionBlock>

      <div className="rb-autoGrid">
        <StatCallout label="People" value={snapshot.counts.employees_active} detail={`Active employees of ${snapshot.counts.employees_total} total.`} />
        <StatCallout label="Devices" value={snapshot.counts.devices_active} detail={`Active devices of ${snapshot.counts.devices_total} total.`} />
        <StatCallout label="Desktop" value={snapshot.counts.desktops_active} detail="Connected desktop clients." tone="subtle" />
        <StatCallout label="Attention" value={snapshot.health.offline_devices + snapshot.health.stale_devices} detail={`${snapshot.health.offline_devices} offline and ${snapshot.health.stale_devices} stale devices.`} tone={snapshot.health.offline_devices + snapshot.health.stale_devices > 0 ? "warning" : "healthy"} />
      </div>

      <SectionBlock title="Shop Summary" description="Key identity, access, and readiness details in one consistent readout.">
        <DataList items={[
          { label: "Role", value: snapshot.member_role },
          { label: "Desktop Access", value: snapshot.access.desktop_mode === "full" ? "Full Access" : "Read-Only" },
          { label: "Workstation Access", value: snapshot.access.workstation_mode === "full" ? "Available" : "Blocked" },
          { label: "Mobile Access", value: snapshot.access.mobile_mode === "full" ? "Full Access" : snapshot.access.mobile_mode === "queue_only" ? "Queue-Only" : "Blocked" },
          { label: "Mobile Ready", value: snapshot.counts.employees_mobile_ready },
          { label: "Workstation Ready", value: snapshot.counts.employees_workstation_ready },
        ]} />
      </SectionBlock>

      <SectionBlock title="Suggested Next Steps" description="Keep the sequence explicit for admins who are moving from setup into operations.">
        <NoteList
          items={[
            "Confirm billing and access are in the expected state.",
            "Register or review devices for Desktop and Workstation.",
            "Review which employees are ready for Mobile and Workstation.",
            "Check recent activity before troubleshooting anything deeper.",
          ]}
        />
      </SectionBlock>
    </div>
  );
}
