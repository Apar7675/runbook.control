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
      <div style={{ display: "grid", gap: 20 }}>
        <PageHeader
          eyebrow="People"
          title="People Center"
          description="Add a shop first so employee provisioning, app access, and workstation eligibility have somewhere to live."
          actions={returnTo ? <ActionLink href={returnTo}>Return to Setup</ActionLink> : undefined}
        />
        <EmptyState
          title="No shop available"
          description="The People area becomes useful after shop setup is complete."
          action={<ActionLink href="/shops" tone="primary">Open Shop Setup</ActionLink>}
        />
      </div>
    );
  }

  const accessReady = snapshot.counts.employees_mobile_ready + snapshot.counts.employees_workstation_ready;
  const syncHealth =
    snapshot.counts.employees_total === 0 ? "Pending" : accessReady === 0 ? "Action Needed" : "Healthy";

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <PageHeader
        eyebrow="People"
        title={`People for ${snapshot.name}`}
        description="This is the employee center: who is active, who has app access, and who still needs provisioning review."
        actions={
          <>
            {returnTo ? <ActionLink href={returnTo}>Return to Setup</ActionLink> : null}
            <ActionLink href={`/shops/${snapshot.id}`} tone="primary">Review Shop</ActionLink>
            <ActionLink href={`/shops/${snapshot.id}/billing`}>Review Access Impact</ActionLink>
          </>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        <MetricCard title="Employees" value={String(snapshot.counts.employees_total)} summary={`${snapshot.counts.employees_active} currently active employees.`} tone={snapshot.counts.employees_total === 0 ? "subtle" : "healthy"} />
        <MetricCard title="Mobile Access" value={String(snapshot.counts.employees_mobile_ready)} summary="Ready to sign in and use Mobile." tone="subtle" />
        <MetricCard title="Workstation Access" value={String(snapshot.counts.employees_workstation_ready)} summary="Ready for passcode-based workstation access." tone="subtle" />
        <MetricCard title="Sync Status" value={syncHealth} summary={snapshot.counts.employees_total === 0
          ? "No employees are connected yet."
          : accessReady === 0
          ? "Employees exist, but app access still needs setup."
          : "Employees are synced well enough to continue with access setup and review."} badge={<StatusBadge label={syncHealth} tone={toneFromStatus(syncHealth)} />} tone={toneFromStatus(syncHealth) === "critical" ? "critical" : toneFromStatus(syncHealth) === "warning" ? "warning" : "subtle"} />
      </div>

      <SectionBlock
        title="Admin Guidance"
        description="Turn raw provisioning mechanics into clear workflows."
      >
        <DataList
          items={[
            { label: "Start", value: "Add or import employees from Desktop HR." },
            { label: "Review", value: "Decide which employees should have Mobile and Workstation access." },
            { label: "Confirm", value: "Check billing before assuming access setup is broken." },
          ]}
        />
      </SectionBlock>

      <SectionBlock
        title="Advanced Controls"
        description="The deeper employee provisioning workflow still lives in the shop workspace until the dedicated editor is consolidated."
        actions={<ActionLink href={`/shops/${snapshot.id}`}>Open Shop Workspace</ActionLink>}
      >
        <div style={{ color: "rgba(230,232,239,0.82)", lineHeight: 1.55 }}>
          Control still uses existing Desktop employee sync and workstation policy routes behind the scenes. This page keeps the explanation simple while preserving those working flows.
        </div>
      </SectionBlock>
    </div>
  );
}
