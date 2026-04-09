import React from "react";
import {
  ActionLink,
  DataList,
  EmptyState,
  MetricCard,
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
        <MetricCard title="Access" value={snapshot.access.display_status} summary={snapshot.access.summary} badge={<StatusBadge label={snapshot.access.display_status} tone={toneFromStatus(snapshot.access.display_status)} />} tone={toneFromStatus(snapshot.access.display_status) === "critical" ? "critical" : toneFromStatus(snapshot.access.display_status) === "warning" ? "warning" : "subtle"} />
        <MetricCard title="People" value={String(snapshot.counts.employees_active)} summary={`Active employees of ${snapshot.counts.employees_total} total.`} tone={snapshot.counts.employees_total === 0 ? "subtle" : "healthy"} />
        <MetricCard title="Devices" value={String(snapshot.counts.devices_active)} summary={`Active devices of ${snapshot.counts.devices_total} total.`} tone={snapshot.health.offline_devices > 0 ? "critical" : snapshot.health.stale_devices > 0 ? "warning" : "healthy"} />
        <MetricCard title="Attention" value={String(snapshot.health.offline_devices + snapshot.health.stale_devices)} summary={`${snapshot.health.offline_devices} offline and ${snapshot.health.stale_devices} stale devices.`} tone={snapshot.health.offline_devices + snapshot.health.stale_devices > 0 ? "warning" : "subtle"} />
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
        <div style={{ display: "grid", gap: 12 }}>
          {[
            "Confirm billing and access are in the expected state.",
            "Register or review devices for Desktop and Workstation.",
            "Review which employees are ready for Mobile and Workstation.",
            "Check recent activity before troubleshooting anything deeper.",
          ].map((step, index) => (
            <div key={step} style={{ display: "grid", gridTemplateColumns: "32px 1fr", gap: 12, alignItems: "start" }}>
              <div style={{ width: 32, height: 32, borderRadius: 999, border: "1px solid rgba(126,171,217,0.18)", background: "rgba(126,171,217,0.08)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 900 }}>
                {index + 1}
              </div>
              <div style={{ color: "rgba(230,232,239,0.82)", lineHeight: 1.58 }}>{step}</div>
            </div>
          ))}
        </div>
      </SectionBlock>
    </div>
  );
}
