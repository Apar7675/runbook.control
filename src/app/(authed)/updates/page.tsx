import React from "react";
import UpdateReleaseManagerClient from "@/components/UpdateReleaseManagerClient";
import { ActionLink, KeyValueGrid, PageHeader, SectionBlock, StatusBadge } from "@/components/control/ui";
import { getCurrentRelease, listReleases } from "@/lib/updates/releases";

export const dynamic = "force-dynamic";

export default async function UpdatesPage() {
  const desktopCurrent = await getCurrentRelease("desktop", "stable");
  const workstationCurrent = await getCurrentRelease("workstation", "stable");
  const releases = await listReleases("desktop", "stable");

  return (
    <div className="rb-page">
      <PageHeader
        eyebrow="Updates"
        title="Release Command Center"
        description="Control is the authority for Desktop and Workstation release state, minimum supported versions, required-update policy, and release notes."
        actions={
          <>
            <ActionLink href="/devices">Review Devices</ActionLink>
            <ActionLink href="/updates/packages" tone="primary">Release Archive</ActionLink>
          </>
        }
      />

      <div className="rb-autoGrid">
        <SectionBlock title="Desktop Stable" description="The Desktop release that clients currently treat as live on the stable channel.">
          <div className="rb-chipRow">
            <StatusBadge label={desktopCurrent ? "Published" : "Not Set"} tone={desktopCurrent ? "healthy" : "warning"} />
          </div>
          <div className="rb-metricValue">{desktopCurrent?.version ?? "-"}</div>
          <KeyValueGrid
            items={[
              { label: "Minimum Supported", value: desktopCurrent?.min_supported_version ?? "-" },
              { label: "Required Update", value: desktopCurrent?.required_update ? "Enabled" : "Optional" },
            ]}
          />
        </SectionBlock>

        <SectionBlock title="Workstation Stable" description="The Workstation release that clients currently treat as live on the stable channel.">
          <div className="rb-chipRow">
            <StatusBadge label={workstationCurrent ? "Published" : "Not Set"} tone={workstationCurrent ? "healthy" : "warning"} />
          </div>
          <div className="rb-metricValue">{workstationCurrent?.version ?? "-"}</div>
          <KeyValueGrid
            items={[
              { label: "Minimum Supported", value: workstationCurrent?.min_supported_version ?? "-" },
              { label: "Required Update", value: workstationCurrent?.required_update ? "Enabled" : "Optional" },
            ]}
          />
        </SectionBlock>
      </div>

      <SectionBlock
        title="Publish a Release"
        description="Upload the installer package, decide whether it is optional or required, and publish it as the current release for Desktop or Workstation."
      >
        <UpdateReleaseManagerClient initialReleases={releases} />
      </SectionBlock>
    </div>
  );
}
