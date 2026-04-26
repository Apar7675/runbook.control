import React from "react";
import { redirect } from "next/navigation";
import { ControlActionLinkV2 } from "@/components/control/v2/ControlActionButtonV2";
import ControlPanelV2 from "@/components/control/v2/ControlPanelV2";
import { controlV2Theme as t } from "@/components/control/v2/controlV2Theme";
import ShopsDirectoryWorkspaceV2, { type ShopDirectoryRowV2 } from "@/components/shops/v2/ShopsDirectoryWorkspaceV2";
import { getPlatformSnapshot, getShopSnapshot, getViewerContext } from "@/lib/control/summary";

export const dynamic = "force-dynamic";

export default async function ShopsPage() {
  const context = await getViewerContext();

  if (!context.isPlatformAdmin && context.shops.length === 1) {
    redirect(`/shops/${context.shops[0].id}`);
  }

  if (context.shops.length === 0) {
    return (
      <div style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ color: t.color.textQuiet, ...t.type.label }}>Shops</div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>Shop setup</h1>
          <div style={{ fontSize: 13, color: t.color.textQuiet }}>Create or connect a shop before managing people, devices, billing, and access.</div>
        </div>
        <ControlPanelV2
          title="No shops available yet"
          description="Start by creating the first shop profile."
          actions={<ControlActionLinkV2 href="/create-shop" tone="primary">Create shop</ControlActionLinkV2>}
        >
          <div style={{ fontSize: 12.5, color: t.color.textMuted }}>This account does not currently have any shop workspaces.</div>
        </ControlPanelV2>
      </div>
    );
  }

  const [platformSnapshot, snapshots] = await Promise.all([
    getPlatformSnapshot(context),
    Promise.all(context.shops.map((shop) => getShopSnapshot(shop))),
  ]);

  const rows: ShopDirectoryRowV2[] = snapshots.map((shop) => ({
    id: shop.id,
    name: shop.name,
    member_role: shop.member_role,
    access_display_status: shop.access.display_status,
    access_summary: shop.access.summary,
    billing_status: shop.billing_status ?? "Unknown",
    employees_active: shop.counts.employees_active,
    employees_total: shop.counts.employees_total,
    devices_active: shop.counts.devices_active,
    devices_total: shop.counts.devices_total,
    offline_devices: shop.health.offline_devices,
    stale_devices: shop.health.stale_devices,
    recent_audit_events: shop.health.recent_audit_events,
    last_activity_at: shop.health.last_device_activity_at ?? shop.billing_current_period_end ?? shop.trial_ends_at ?? null,
    created_at: context.shops.find((candidate) => candidate.id === shop.id)?.created_at ?? null,
  }));

  return (
    <ShopsDirectoryWorkspaceV2
      isPlatformAdmin={context.isPlatformAdmin}
      manageableShopCount={platformSnapshot.manageableShopCount}
      deviceCount={platformSnapshot.deviceCount}
      rows={rows}
    />
  );
}
