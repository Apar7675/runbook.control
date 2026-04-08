import React from "react";
import { redirect } from "next/navigation";
import DeleteShopButton from "@/components/DeleteShopButton";
import { ActionLink, DataList, EmptyState, PageHeader, SectionBlock, StatusBadge, toneFromStatus } from "@/components/control/ui";
import { getShopSnapshot, getViewerContext } from "@/lib/control/summary";

export const dynamic = "force-dynamic";

export default async function ShopsPage() {
  const context = await getViewerContext();

  if (!context.isPlatformAdmin && context.shops.length === 1) {
    redirect(`/shops/${context.shops[0].id}`);
  }

  if (context.shops.length === 0) {
    return (
      <div className="rb-page">
        <PageHeader eyebrow="Shop" title="Shop Setup" description="Create or connect a shop before you start managing people, devices, billing, and app access." actions={<ActionLink href="/create-shop" tone="primary">Create Shop</ActionLink>} />
        <EmptyState title="No shops available yet" description="A novice admin should never land on a blank record list with no guidance. Start by creating the first shop profile." action={<ActionLink href="/create-shop" tone="primary">Create Shop</ActionLink>} />
      </div>
    );
  }

  const snapshots = await Promise.all(context.shops.map((shop) => getShopSnapshot(shop)));

  return (
    <div className="rb-page">
      <PageHeader eyebrow="Shop" title={context.isPlatformAdmin ? "Shop Command Center" : "Your Shops"} description="Each shop card leads with status, readiness, and authority so billing, people, and devices are easy to scan." actions={context.isPlatformAdmin ? <ActionLink href="/create-shop" tone="primary">Create Shop</ActionLink> : undefined} />

      <SectionBlock title="Shop Overview" description="Operational state first, deeper workflows second.">
        <div className="rb-stack">
          {snapshots.map((shop) => {
            const deviceStatus = shop.health.offline_devices > 0 ? "Action Needed" : shop.health.stale_devices > 0 ? "Warning" : "Healthy";
            return (
              <div key={shop.id} className="rb-shopCard">
                <div className="rb-rowBetween">
                  <div className="rb-stack" style={{ gap: 10 }}>
                    <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.04em" }}>{shop.name}</div>
                    <div className="rb-chipRow">
                      <StatusBadge label={shop.access.display_status} tone={toneFromStatus(shop.access.display_status)} />
                      <StatusBadge label={deviceStatus} tone={toneFromStatus(deviceStatus)} />
                      <StatusBadge label={shop.member_role} tone="neutral" />
                    </div>
                  </div>
                  <div className="rb-inlineRow">
                    <ActionLink href={`/shops/${shop.id}`} tone="primary">Open Shop</ActionLink>
                    <ActionLink href={`/shops/${shop.id}/billing`}>Billing & Access</ActionLink>
                  </div>
                </div>

                <div className="rb-pageCopy">{shop.access.summary}</div>

                <div className="rb-statStrip">
                  <div className="rb-statCell"><div className="rb-statCell__label">People</div><div className="rb-statCell__value">{shop.counts.employees_active}</div><div className="rb-fine">Active of {shop.counts.employees_total}</div></div>
                  <div className="rb-statCell"><div className="rb-statCell__label">Devices</div><div className="rb-statCell__value">{shop.counts.devices_active}</div><div className="rb-fine">Active of {shop.counts.devices_total}</div></div>
                  <div className="rb-statCell"><div className="rb-statCell__label">Desktop</div><div className="rb-statCell__value">{shop.counts.desktops_active}</div><div className="rb-fine">Active desktop devices</div></div>
                  <div className="rb-statCell"><div className="rb-statCell__label">Workstation</div><div className="rb-statCell__value">{shop.counts.workstations_active}</div><div className="rb-fine">Active workstation devices</div></div>
                </div>

                <DataList items={[{ label: "Mobile Ready", value: `${shop.counts.employees_mobile_ready} employees` }, { label: "Workstation Ready", value: `${shop.counts.employees_workstation_ready} employees` }]} />

                {context.isPlatformAdmin ? (
                  <div style={{ display: "grid", gap: 12, paddingTop: 6, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                    <div className="rb-fine" style={{ color: "rgba(255,213,213,0.78)" }}>
                      Danger zone. Delete and reset actions are intentionally separated from everyday shop navigation.
                    </div>
                    <div className="rb-inlineRow">
                      <DeleteShopButton shopId={shop.id} shopName={shop.name} />
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </SectionBlock>
    </div>
  );
}
