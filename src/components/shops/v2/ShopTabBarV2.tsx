"use client";

import React from "react";
import ControlTabsV2 from "@/components/control/v2/ControlTabsV2";

export type ShopWorkspaceTabKeyV2 = "overview" | "users" | "billing" | "devices" | "activity";

export default function ShopTabBarV2({
  shopId,
  activeTab,
}: {
  shopId: string;
  activeTab: ShopWorkspaceTabKeyV2;
}) {
  return (
    <ControlTabsV2
      activeKey={activeTab}
      tabs={[
        { key: "overview", label: "Overview", href: `/shops/${shopId}` },
        { key: "users", label: "Users", href: `/shops/${shopId}?tab=users` },
        { key: "billing", label: "Billing", href: `/shops/${shopId}?tab=billing` },
        { key: "devices", label: "Devices", href: `/shops/${shopId}?tab=devices` },
        { key: "activity", label: "Activity", href: `/shops/${shopId}?tab=activity` },
      ]}
    />
  );
}
