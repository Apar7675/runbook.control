import React from "react";
import { ActionLink, DataList, EmptyState, PageHeader, SectionBlock, StatusBadge } from "@/components/control/ui";
import { listReleases } from "@/lib/updates/releases";

export const dynamic = "force-dynamic";

export default async function UpdatePackagesPage() {
  const releases = await listReleases();

  return (
    <div className="rb-page">
      <PageHeader
        eyebrow="Updates"
        title="Release Archive"
        description="Review previously uploaded Desktop and Workstation release packages without changing the current release from this page."
        actions={<ActionLink href="/updates" tone="primary">Back to Release Command Center</ActionLink>}
      />

      <SectionBlock title="Uploaded Releases" description="These are the release packages Control currently recognizes as part of its managed update history.">
        {releases.length === 0 ? (
          <EmptyState title="No releases uploaded yet" description="Go back to the Updates page to upload and publish the first Desktop or Workstation release." />
        ) : (
          <div className="rb-dataGrid">
            {releases.map((release) => (
              <div key={release.id} className={release.is_current ? "rb-releaseCard rb-releaseCard--current" : "rb-releaseCard"}>
                <div className="rb-releaseCard__top">
                  <div>
                    <div className="rb-releaseCard__title">{release.app_id} {release.channel} {release.version}</div>
                    <div className="rb-pageCopy">{release.file_name ?? release.file_path}</div>
                  </div>
                  <div className="rb-inlineRow">
                    {release.is_current ? <StatusBadge label="Current" tone="healthy" /> : null}
                    <StatusBadge label={release.required_update ? "Required" : "Optional"} tone={release.required_update ? "critical" : "neutral"} />
                  </div>
                </div>

                <DataList
                  items={[
                    { label: "Minimum Supported", value: release.min_supported_version || "Not set" },
                    { label: "Published", value: release.published_at || "Draft / uploaded only" },
                    { label: "Created", value: release.created_at },
                  ]}
                />

                {release.notes ? <div className="rb-pageCopy">{release.notes}</div> : null}
              </div>
            ))}
          </div>
        )}
      </SectionBlock>
    </div>
  );
}
