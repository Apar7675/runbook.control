import React from "react";
import type { ShopSnapshot } from "@/lib/control/summary";
import type { ShopWorkspaceTabKeyV2 } from "@/components/shops/v2/ShopTabBarV2";
import ShopHeaderV2 from "@/components/shops/v2/ShopHeaderV2";
import ShopTabBarV2 from "@/components/shops/v2/ShopTabBarV2";
import OverviewTabV2 from "@/components/shops/v2/OverviewTabV2";
import UsersTabV2 from "@/components/shops/v2/UsersTabV2";
import BillingTabV2 from "@/components/shops/v2/BillingTabV2";
import DevicesTabV2, { type ShopDeviceRowV2 } from "@/components/shops/v2/DevicesTabV2";
import ActivityTabV2 from "@/components/shops/v2/ActivityTabV2";
import ControlPanelV2 from "@/components/control/v2/ControlPanelV2";

export default function ShopWorkspaceShellV2({
  snapshot,
  activeTab,
  isPlatformAdmin,
  deviceRows,
}: {
  snapshot: ShopSnapshot;
  activeTab: ShopWorkspaceTabKeyV2;
  isPlatformAdmin: boolean;
  deviceRows: ShopDeviceRowV2[];
}) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <ShopHeaderV2 snapshot={snapshot} />
      <ShopTabBarV2 shopId={snapshot.id} activeTab={activeTab} />

      {activeTab === "overview" ? <OverviewTabV2 snapshot={snapshot} isPlatformAdmin={isPlatformAdmin} /> : null}
      {activeTab === "users" ? <UsersTabV2 shopId={snapshot.id} /> : null}
      {activeTab === "billing" ? (
        isPlatformAdmin ? (
          <BillingTabV2 shopId={snapshot.id} />
        ) : (
          <ControlPanelV2 title="Platform Admin Access Required" description="Billing controls stay restricted to platform admins.">
            <div />
          </ControlPanelV2>
        )
      ) : null}
      {activeTab === "devices" ? <DevicesTabV2 snapshot={snapshot} devices={deviceRows} /> : null}
      {activeTab === "activity" ? <ActivityTabV2 shopId={snapshot.id} /> : null}
    </div>
  );
}
