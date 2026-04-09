import React from "react";
import { redirect } from "next/navigation";
import DeleteShopButton from "@/components/DeleteShopButton";
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
import { getShopSnapshot, getViewerContext } from "@/lib/control/summary";
import { theme } from "@/lib/ui/theme";

export const dynamic = "force-dynamic";

export default async function ShopsPage() {
  const context = await getViewerContext();

  if (!context.isPlatformAdmin && context.shops.length === 1) {
    redirect(`/shops/${context.shops[0].id}`);
  }

  if (context.shops.length === 0) {
    return (
      <div style={{ display: "grid", gap: 20 }}>
        <PageHeader
          eyebrow="Shop"
          title="Shop Setup"
          description="Create or connect a shop before you start managing people, devices, billing, and app access."
          actions={<ActionLink href="/create-shop" tone="primary">Create Shop</ActionLink>}
        />
        <EmptyState
          title="No shops available yet"
          description="A novice admin should never land on a blank record list with no guidance. Start by creating the first shop profile."
          action={<ActionLink href="/create-shop" tone="primary">Create Shop</ActionLink>}
        />
      </div>
    );
  }

  const snapshots = await Promise.all(context.shops.map((shop) => getShopSnapshot(shop)));

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <PageHeader
        eyebrow="Shop"
        title={context.isPlatformAdmin ? "Shop Command Center" : "Your Shops"}
        description="Review shop profile, current access, device health, and membership at a glance. Technical implementation details stay behind the scenes."
        actions={context.isPlatformAdmin ? <ActionLink href="/create-shop" tone="primary">Create Shop</ActionLink> : undefined}
      />

      <SectionBlock
        title="Shop Overview"
        description="Each shop card leads with operational status first, then links into deeper admin workflows."
      >
        <div style={{ display: "grid", gap: 12 }}>
          {snapshots.map((shop) => {
            const deviceStatus =
              shop.health.offline_devices > 0 ? "Action Needed" : shop.health.stale_devices > 0 ? "Warning" : "Healthy";
            return (
              <div
                key={shop.id}
                style={{
                  display: "grid",
                  gap: 12,
                  border: toneFromStatus(shop.access.display_status) === "critical" ? theme.border.critical : toneFromStatus(shop.access.display_status) === "warning" ? theme.border.warning : theme.border.accentSoft,
                  borderRadius: 16,
                  background: "radial-gradient(circle at top right, rgba(126,171,217,0.08), transparent 32%), linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01)), " + theme.bg.panelRaised,
                  padding: 14,
                  boxShadow: theme.shadow.glowSoft,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div style={{ display: "grid", gap: 10 }}>
                    <div style={{ display: "grid", gap: 4 }}>
                      <div style={{ color: theme.text.quiet, fontSize: 11, fontWeight: 900, letterSpacing: 0.84, textTransform: "uppercase" }}>
                        Shop Workspace
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: -0.28 }}>{shop.name}</div>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <StatusBadge label={shop.access.display_status} tone={toneFromStatus(shop.access.display_status)} />
                      <StatusBadge label={deviceStatus} tone={toneFromStatus(deviceStatus)} />
                      <StatusBadge label={shop.member_role} tone="neutral" />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <ActionLink href={`/shops/${shop.id}`} tone="primary">Open Shop</ActionLink>
                    <ActionLink href={`/shops/${shop.id}/billing`}>Billing & Access</ActionLink>
                    {context.isPlatformAdmin ? <DeleteShopButton shopId={shop.id} shopName={shop.name} /> : null}
                  </div>
                </div>

                <div style={{ color: theme.text.muted, lineHeight: 1.56 }}>{shop.access.summary}</div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
                  <MetricCard title="People" value={String(shop.counts.employees_active)} summary={`${shop.counts.employees_total} total employees in this shop.`} tone="subtle" />
                  <MetricCard title="Devices" value={String(shop.counts.devices_active)} summary={`${shop.counts.devices_total} registered devices across the shop.`} tone="subtle" />
                  <MetricCard title="Ready" value={String(shop.counts.employees_workstation_ready)} summary={`${shop.counts.employees_mobile_ready} employees also ready for Mobile.`} tone="subtle" />
                </div>

                <div>
                  <DataList
                    items={[
                      { label: "Desktop", value: `${shop.counts.desktops_active} active desktop devices` },
                      { label: "Workstation", value: `${shop.counts.workstations_active} active workstation devices` },
                      { label: "Mobile Ready", value: `${shop.counts.employees_mobile_ready} employees` },
                    ]}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </SectionBlock>
    </div>
  );
}
