import React from "react";
import { ActionLink, NoteList, PageHeader, SectionBlock } from "@/components/control/ui";

export const dynamic = "force-dynamic";

export default async function SupportPage() {
  return (
    <div className="rb-page">
      <PageHeader
        eyebrow="Support"
        title="Support Bundles"
        description="Diagnostic exports should feel like part of the same premium control center, not a placeholder utility page."
        actions={<ActionLink href="/shops" tone="primary">Back to Shops</ActionLink>}
      />

      <SectionBlock title="Bundle Purpose" description="Support bundles exist to accelerate troubleshooting without exposing unsafe or noisy raw system detail.">
        <div className="rb-pageCopy">
          A support bundle is a diagnostic export a shop can generate when something goes wrong. It should include safe-to-share logs and metadata so operators can troubleshoot quickly without requesting manual screenshots or ad hoc file copies.
        </div>
      </SectionBlock>

      <SectionBlock title="What Comes Next" description="The page now matches the shared RunBook language, and the next pass can focus on feature depth instead of basic presentation repair.">
        <NoteList
          items={[
            "List support bundles per shop from `rb_support_bundles`.",
            "Download bundle files from storage with the same control-surface chrome used elsewhere.",
            "Add future bundle generation flows from device or shop context without introducing a one-off UI style.",
          ]}
        />
      </SectionBlock>
    </div>
  );
}
