import React from "react";
import ControlPanelV2 from "@/components/control/v2/ControlPanelV2";
import { ControlActionLinkV2 } from "@/components/control/v2/ControlActionButtonV2";
import { controlV2Theme as t } from "@/components/control/v2/controlV2Theme";
import BillingAccessDirectoryWorkspaceV2 from "@/components/billing/BillingAccessDirectoryWorkspaceV2";
import { getViewerContext } from "@/lib/control/summary";

export const dynamic = "force-dynamic";

export default async function BillingAccessPage() {
  const context = await getViewerContext();

  if (!context.isPlatformAdmin) {
    return (
      <div style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ color: t.color.textQuiet, ...t.type.label }}>Billing & Access</div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>Billing access directory</h1>
          <div style={{ fontSize: 13, color: t.color.textQuiet }}>This directory is reserved for platform admins managing billing and entitlement across shops.</div>
        </div>
        <ControlPanelV2
          title="Platform admin access required"
          description="Open a specific shop workspace instead if you only need to review billing for one shop."
          actions={<ControlActionLinkV2 href="/shops" tone="primary">Open shops</ControlActionLinkV2>}
        >
          <div style={{ fontSize: 12.5, color: t.color.textMuted }}>Cross-shop billing and entitlement controls stay restricted to platform admins.</div>
        </ControlPanelV2>
      </div>
    );
  }

  return <BillingAccessDirectoryWorkspaceV2 />;
}
