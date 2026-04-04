import React from "react";
import {
  ActionLink,
  EmptyState,
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
    <div style={{ display: "grid", gap: 22 }}>
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

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        <SectionBlock title="Employees" description="Lead with simple counts that answer the first admin question.">
          <div style={{ fontSize: 34, fontWeight: 900 }}>{snapshot.counts.employees_total}</div>
          <div style={{ color: "rgba(230,232,239,0.8)" }}>{snapshot.counts.employees_active} currently active employees.</div>
        </SectionBlock>
        <SectionBlock title="Mobile Access" description="Employees currently eligible for Mobile access.">
          <div style={{ fontSize: 34, fontWeight: 900 }}>{snapshot.counts.employees_mobile_ready}</div>
          <div style={{ color: "rgba(230,232,239,0.8)" }}>Ready to sign in and use Mobile.</div>
        </SectionBlock>
        <SectionBlock title="Workstation Access" description="Employees currently eligible for Workstation sign-in.">
          <div style={{ fontSize: 34, fontWeight: 900 }}>{snapshot.counts.employees_workstation_ready}</div>
          <div style={{ color: "rgba(230,232,239,0.8)" }}>Ready for passcode-based workstation access.</div>
        </SectionBlock>
        <SectionBlock title="Sync Status" description="Summarize employee readiness in plain language.">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <StatusBadge label={syncHealth} tone={toneFromStatus(syncHealth)} />
          </div>
          <div style={{ color: "rgba(230,232,239,0.8)", marginTop: 8 }}>
            {snapshot.counts.employees_total === 0
              ? "No employees are connected yet."
              : accessReady === 0
              ? "Employees exist, but app access still needs setup."
              : "Employees are synced well enough to continue with access setup and review."}
          </div>
        </SectionBlock>
      </div>

      <SectionBlock
        title="Admin Guidance"
        description="Turn raw provisioning mechanics into clear workflows."
      >
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ fontWeight: 900 }}>Recommended actions</div>
          <div style={{ color: "rgba(230,232,239,0.82)", lineHeight: 1.55 }}>
            1. Add or import employees from Desktop HR.
          </div>
          <div style={{ color: "rgba(230,232,239,0.82)", lineHeight: 1.55 }}>
            2. Review which employees should have Mobile and Workstation access.
          </div>
          <div style={{ color: "rgba(230,232,239,0.82)", lineHeight: 1.55 }}>
            3. Confirm billing allows the access level you expect before troubleshooting setup.
          </div>
        </div>
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
