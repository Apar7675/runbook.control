import React from "react";
import { redirect } from "next/navigation";
import DeleteShopButton from "@/components/DeleteShopButton";
import {
  ActionLink,
  DataList,
  EmptyState,
  PageHeader,
  SectionBlock,
  StatusBadge,
  toneFromStatus,
} from "@/components/control/ui";
import { getShopSnapshot, getViewerContext } from "@/lib/control/summary";

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
    <div style={{ display: "grid", gap: 22 }}>
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
        <div style={{ display: "grid", gap: 16 }}>
          {snapshots.map((shop) => {
            const deviceStatus =
              shop.health.offline_devices > 0 ? "Action Needed" : shop.health.stale_devices > 0 ? "Warning" : "Healthy";
            return (
              <div
                key={shop.id}
                style={{
                  display: "grid",
                  gap: 16,
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 18,
                  background: "rgba(255,255,255,0.03)",
                  padding: 18,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div style={{ display: "grid", gap: 8 }}>
                    <div style={{ fontSize: 22, fontWeight: 900 }}>{shop.name}</div>
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

                <div style={{ color: "rgba(230,232,239,0.82)", lineHeight: 1.5 }}>{shop.access.summary}</div>

                <DataList
                  items={[
                    { label: "People", value: `${shop.counts.employees_active} active of ${shop.counts.employees_total}` },
                    { label: "Devices", value: `${shop.counts.devices_active} active of ${shop.counts.devices_total}` },
                    { label: "Desktop", value: `${shop.counts.desktops_active} active desktop devices` },
                    { label: "Workstation", value: `${shop.counts.workstations_active} active workstation devices` },
                    { label: "Mobile Ready", value: `${shop.counts.employees_mobile_ready} employees` },
                    { label: "Workstation Ready", value: `${shop.counts.employees_workstation_ready} employees` },
                  ]}
                />
              </div>
            );
          })}
        </div>
      </SectionBlock>
    </div>
  );
}
