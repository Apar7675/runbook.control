import React from "react";
import { redirect } from "next/navigation";
import ControlPanelV2 from "@/components/control/v2/ControlPanelV2";
import { ControlActionLinkV2 } from "@/components/control/v2/ControlActionButtonV2";
import { controlV2Theme as t } from "@/components/control/v2/controlV2Theme";
import PeopleDirectoryWorkspaceV2 from "@/components/people/PeopleDirectoryWorkspaceV2";
import { getViewerContext, selectPrimaryShop } from "@/lib/control/summary";

export const dynamic = "force-dynamic";

export default async function PeoplePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const requestedShopId = typeof params.shop === "string" ? params.shop : "";
  const returnTo = typeof params.return_to === "string" ? params.return_to : "";
  const context = await getViewerContext();
  const primaryShop = selectPrimaryShop(context.shops, requestedShopId);

  if (!primaryShop) {
    return (
      <div style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ color: t.color.textQuiet, ...t.type.label }}>People</div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>Shop People</h1>
          <div style={{ fontSize: 13, color: t.color.textQuiet }}>Add a shop first so employee provisioning and access review have somewhere to live.</div>
        </div>
        <ControlPanelV2
          title="No shop available"
          description="The People area becomes useful after shop setup is complete."
          actions={
            <>
              {returnTo ? <ControlActionLinkV2 href={returnTo}>Return to setup</ControlActionLinkV2> : null}
              <ControlActionLinkV2 href="/shops" tone="primary">Open shop setup</ControlActionLinkV2>
            </>
          }
        >
          <div style={{ fontSize: 12.5, color: t.color.textMuted }}>This account does not currently have a shop workspace available for people management.</div>
        </ControlPanelV2>
      </div>
    );
  }

  if (!requestedShopId && context.shops.length === 1) {
    redirect(`/people?shop=${encodeURIComponent(primaryShop.id)}`);
  }

  return <PeopleDirectoryWorkspaceV2 shopId={primaryShop.id} shopName={primaryShop.name} />;
}
