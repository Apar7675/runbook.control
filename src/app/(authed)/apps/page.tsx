import React from "react";
import { ActionLink, EmptyState, KeyValueGrid, PageHeader, SectionBlock, StatusBadge, toneFromStatus } from "@/components/control/ui";
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
      <div className="rb-page">
        <PageHeader eyebrow="Apps" title="App Access" description="Apps inherit their access state from shop setup, device health, and billing." />
        <EmptyState title="No app connections to review yet" description="Set up a shop first, then register devices and provision employees." action={<ActionLink href="/shops" tone="primary">Open Shop Setup</ActionLink>} />
      </div>
    );
  }

  const desktopStatus = displayDesktop(snapshot.access.desktop_mode);
  const mobileStatus = displayMobile(snapshot.access.mobile_mode);
  const workstationStatus = displayWorkstation(snapshot.access.workstation_mode);
  const controlStatus = "Healthy";

  return (
    <div className="rb-page">
      <PageHeader
        eyebrow="Apps"
        title={`App Access for ${snapshot.name}`}
        description="Control should make app health obvious: what is connected, what is restricted, and what needs attention next."
        actions={<><ActionLink href="/devices" tone="primary">Review Devices</ActionLink><ActionLink href="/billing-access">Review Billing Impact</ActionLink></>}
      />

      <div className="rb-autoGrid">
        <SectionBlock title="Desktop" description="Bootstrap, registration, and employee directory health." tone={desktopStatus === "Connected" ? "healthy" : desktopStatus === "Degraded" ? "warning" : "critical"}>
          <div className="rb-chipRow"><StatusBadge label={desktopStatus} tone={toneFromStatus(desktopStatus)} /></div>
          <div className="rb-pageCopy">{snapshot.counts.desktops_active > 0 ? `${snapshot.counts.desktops_active} desktop devices are active for this shop.` : "No desktop devices are registered yet."}</div>
          <div className="rb-pageCopy">{snapshot.access.desktop_mode === "full" ? "Desktop has full access." : "Desktop is still available, but access is reduced until billing is restored."}</div>
        </SectionBlock>

        <SectionBlock title="Workstation" description="Passcode access and time clock readiness." tone={workstationStatus === "Connected" ? "healthy" : "critical"}>
          <div className="rb-chipRow"><StatusBadge label={workstationStatus} tone={toneFromStatus(workstationStatus)} /></div>
          <div className="rb-pageCopy">{snapshot.counts.workstations_active > 0 ? `${snapshot.counts.workstations_active} workstation devices are active.` : "No workstation devices are active yet."}</div>
          <div className="rb-pageCopy">{snapshot.counts.employees_workstation_ready} employees are ready for workstation sign-in.</div>
        </SectionBlock>

        <SectionBlock title="Mobile" description="Employee eligibility and billing restrictions." tone={mobileStatus === "Connected" ? "healthy" : mobileStatus === "Restricted" ? "warning" : "critical"}>
          <div className="rb-chipRow"><StatusBadge label={mobileStatus} tone={toneFromStatus(mobileStatus)} /></div>
          <div className="rb-pageCopy">{snapshot.counts.employees_mobile_ready} employees are currently eligible for Mobile.</div>
          <div className="rb-pageCopy">{snapshot.access.mobile_mode === "full" ? "Mobile is fully available." : snapshot.access.mobile_mode === "queue_only" ? "Mobile can keep queued punches, but normal access is restricted." : "Mobile is blocked until access is restored."}</div>
        </SectionBlock>

        <SectionBlock title="Control" description="Admin web access and status visibility." tone="subtle">
          <div className="rb-chipRow"><StatusBadge label={controlStatus} tone={toneFromStatus(controlStatus)} /></div>
          <div className="rb-pageCopy">Control remains available for settings, diagnostics, billing review, and admin guidance.</div>
        </SectionBlock>
      </div>

      <SectionBlock title="Operational Readout" description="Translate entitlement outcomes into clear operational language.">
        <KeyValueGrid
          items={[
            { label: "Desktop", value: snapshot.access.desktop_mode === "full" ? "Full Access" : "Reduced" },
            { label: "Workstation", value: snapshot.access.workstation_mode === "full" ? "Ready" : "Blocked" },
            { label: "Mobile", value: snapshot.access.mobile_mode === "full" ? "Full" : snapshot.access.mobile_mode === "queue_only" ? "Queue Only" : "Blocked" },
          ]}
        />
        <div className="rb-pageCopy">{snapshot.access.summary}</div>
      </SectionBlock>
    </div>
  );
}
