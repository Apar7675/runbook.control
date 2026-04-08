import React from "react";
import { ActionLink, EmptyState, NoteList, PageHeader, SectionBlock, StatCallout, StatusBadge, SurfaceLink, toneFromStatus } from "@/components/control/ui";
import { getShopSnapshot, getViewerContext, selectPrimaryShop } from "@/lib/control/summary";

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
  const snapshot = primaryShop ? await getShopSnapshot(primaryShop) : null;

  if (!primaryShop || !snapshot) {
    return (
      <div className="rb-page">
        <PageHeader eyebrow="People" title="People Center" description="Add a shop first so employee provisioning, app access, and workstation eligibility have somewhere to live." actions={returnTo ? <ActionLink href={returnTo}>Return to Setup</ActionLink> : undefined} />
        <EmptyState title="No shop available" description="The People area becomes useful after shop setup is complete." action={<ActionLink href="/shops" tone="primary">Open Shop Setup</ActionLink>} />
      </div>
    );
  }

  const accessReady = snapshot.counts.employees_mobile_ready + snapshot.counts.employees_workstation_ready;
  const syncHealth = snapshot.counts.employees_total === 0 ? "Pending" : accessReady === 0 ? "Action Needed" : "Healthy";

  return (
    <div className="rb-page">
      <PageHeader
        eyebrow="People"
        title={`People for ${snapshot.name}`}
        description="This is the employee center: who is active, who has app access, and who still needs provisioning review."
        actions={<>{returnTo ? <ActionLink href={returnTo}>Return to Setup</ActionLink> : null}<ActionLink href={`/shops/${snapshot.id}`} tone="primary">Review Shop</ActionLink><ActionLink href={`/shops/${snapshot.id}/billing`}>Review Access Impact</ActionLink></>}
      />

      <div className="rb-autoGrid">
        <StatCallout label="Employees" value={snapshot.counts.employees_total} detail={`${snapshot.counts.employees_active} currently active employees.`} />
        <StatCallout label="Mobile Access" value={snapshot.counts.employees_mobile_ready} detail="Ready to sign in and use Mobile." tone={snapshot.counts.employees_mobile_ready > 0 ? "healthy" : "subtle"} />
        <StatCallout label="Workstation Access" value={snapshot.counts.employees_workstation_ready} detail="Ready for passcode-based workstation access." tone={snapshot.counts.employees_workstation_ready > 0 ? "healthy" : "subtle"} />
        <SectionBlock title="Sync Status" description="Summarize employee readiness in plain language." tone={syncHealth === "Healthy" ? "healthy" : syncHealth === "Action Needed" ? "warning" : "subtle"}>
          <div className="rb-chipRow">
            <StatusBadge label={syncHealth} tone={toneFromStatus(syncHealth)} />
          </div>
          <div className="rb-pageCopy">
            {snapshot.counts.employees_total === 0
              ? "No employees are connected yet."
              : accessReady === 0
              ? "Employees exist, but app access still needs setup."
              : "Employees are synced well enough to continue with access setup and review."}
          </div>
        </SectionBlock>
      </div>

      <SectionBlock title="Recommended Workflow" description="Turn raw provisioning mechanics into a clear admin sequence.">
        <NoteList
          items={[
            "Add or import employees from Desktop HR.",
            "Review which employees should have Mobile and Workstation access.",
            "Confirm billing allows the access level you expect before troubleshooting setup.",
          ]}
        />
      </SectionBlock>

      <SectionBlock title="Continue In Workspace" description="The deeper employee provisioning workflow still lives in the shop workspace until the dedicated editor is consolidated.">
        <div className="rb-stack">
          <div className="rb-pageCopy">Control still uses the existing Desktop employee sync and workstation policy routes behind the scenes. This page keeps the explanation simple while preserving those working flows.</div>
          <div className="rb-autoGrid">
            <SurfaceLink href={`/shops/${snapshot.id}`} title="Open Shop Workspace" description="Continue with shop-level employee and access setup in the existing workspace." icon="shop" />
            <SurfaceLink href={`/shops/${snapshot.id}/billing`} title="Review Billing & Access" description="Confirm plan state before troubleshooting missing employee access." icon="billing" />
          </div>
        </div>
      </SectionBlock>
    </div>
  );
}
