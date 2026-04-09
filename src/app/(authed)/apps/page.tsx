import React from "react";
import {
  ActionLink,
  EmptyState,
  MetricCard,
  PageHeader,
  SectionBlock,
  StatusBadge,
  toneFromStatus,
} from "@/components/control/ui";
import { getShopSnapshot, getViewerContext, selectPrimaryShop } from "@/lib/control/summary";

export const dynamic = "force-dynamic";

function displayDesktop(mode: string) {
  return mode === "full" ? "Connected" : mode === "read_only" ? "Degraded" : "Blocked";
}

function displayMobile(mode: string) {
  return mode === "full" ? "Connected" : mode === "queue_only" ? "Restricted" : "Blocked";
}

function displayWorkstation(mode: string) {
  return mode === "full" ? "Connected" : "Blocked";
}

export default async function AppsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const requestedShopId = typeof params.shop === "string" ? params.shop : "";
  const context = await getViewerContext();
  const primaryShop = selectPrimaryShop(context.shops, requestedShopId);
  const snapshot = primaryShop ? await getShopSnapshot(primaryShop) : null;

  if (!primaryShop || !snapshot) {
    return (
      <div style={{ display: "grid", gap: 20 }}>
        <PageHeader eyebrow="Apps" title="App Access" description="Apps inherit their access state from shop setup, device health, and billing." />
        <EmptyState
          title="No app connections to review yet"
          description="Set up a shop first, then register devices and provision employees."
          action={<ActionLink href="/shops" tone="primary">Open Shop Setup</ActionLink>}
        />
      </div>
    );
  }

  const desktopStatus = displayDesktop(snapshot.access.desktop_mode);
  const mobileStatus = displayMobile(snapshot.access.mobile_mode);
  const workstationStatus = displayWorkstation(snapshot.access.workstation_mode);
  const controlStatus = "Healthy";

  return (
    <div style={{ display: "grid", gap: 22 }}>
      <PageHeader
        eyebrow="Apps"
        title={`App Access for ${snapshot.name}`}
        description="Control should make app health obvious: what is connected, what is restricted, and what needs attention next."
        actions={
          <>
            <ActionLink href="/devices" tone="primary">Review Devices</ActionLink>
            <ActionLink href="/billing-access">Review Billing Impact</ActionLink>
          </>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
        <MetricCard title="Desktop" value={desktopStatus} summary={snapshot.counts.desktops_active > 0 ? `${snapshot.counts.desktops_active} desktop devices are active for this shop.` : "No desktop devices are registered yet."} badge={<StatusBadge label={desktopStatus} tone={toneFromStatus(desktopStatus)} />} tone={toneFromStatus(desktopStatus) === "critical" ? "critical" : toneFromStatus(desktopStatus) === "warning" ? "warning" : "healthy"} />
        <MetricCard title="Workstation" value={workstationStatus} summary={`${snapshot.counts.employees_workstation_ready} employees are ready for workstation sign-in.`} badge={<StatusBadge label={workstationStatus} tone={toneFromStatus(workstationStatus)} />} tone={toneFromStatus(workstationStatus) === "critical" ? "critical" : "healthy"} />
        <MetricCard title="Mobile" value={mobileStatus} summary={`${snapshot.counts.employees_mobile_ready} employees are currently eligible for Mobile.`} badge={<StatusBadge label={mobileStatus} tone={toneFromStatus(mobileStatus)} />} tone={toneFromStatus(mobileStatus) === "critical" ? "critical" : toneFromStatus(mobileStatus) === "warning" ? "warning" : "healthy"} />
        <MetricCard title="Control" value={controlStatus} summary="Control remains available for settings, diagnostics, billing review, and admin guidance." badge={<StatusBadge label={controlStatus} tone={toneFromStatus(controlStatus)} />} tone="subtle" />
      </div>

      <SectionBlock title="What This Means" description="Translate entitlement outcomes into clear operational language.">
        <div style={{ display: "grid", gap: 12, color: "rgba(230,232,239,0.82)", lineHeight: 1.55 }}>
          <div>Desktop: {snapshot.access.desktop_mode === "full" ? "Full Access" : "Reduced Access"}</div>
          <div>Workstation: {snapshot.access.workstation_mode === "full" ? "Sign-in Available" : "Blocked"}</div>
          <div>Mobile: {snapshot.access.mobile_mode === "full" ? "Full Access" : snapshot.access.mobile_mode === "queue_only" ? "Queue-Only" : "Blocked"}</div>
          <div>Reason: {snapshot.access.summary}</div>
        </div>
      </SectionBlock>
    </div>
  );
}
