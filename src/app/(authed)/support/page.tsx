import React from "react";
import { ActionLink, PageHeader, SectionBlock } from "@/components/control/ui";

export const dynamic = "force-dynamic";

export default async function SupportPage() {
  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 1100 }}>
      <PageHeader
        eyebrow="Support"
        title="Support Bundles"
        description="This page should eventually become the calm place where an admin gathers the right diagnostic package without digging through technical noise."
      />

      <SectionBlock title="What is a Support Bundle?" description="Explain the concept before showing future tooling.">
        <div style={{ opacity: 0.85, lineHeight: 1.45 }}>
          A Support Bundle is a diagnostic export a shop can generate when something goes wrong. It should contain
          safe-to-share logs and metadata so you can troubleshoot fast.
        </div>
        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
          Note: This page exists to fix the 404 and provide a home for support features. We&apos;ll wire in the actual bundle
          list/upload/download next.
        </div>
      </SectionBlock>

      <SectionBlock title="Next" description="These are the most useful support actions still missing here.">
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ opacity: 0.85 }}>
            Recommended next steps:
            <ul style={{ marginTop: 6, opacity: 0.85 }}>
              <li>List bundles per shop (`rb_support_bundles`).</li>
              <li>Download bundle files from storage.</li>
              <li>Generate a bundle from a device or shop when a support flow starts.</li>
            </ul>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <ActionLink href="/shops">Back to Shops</ActionLink>
          </div>
        </div>
      </SectionBlock>
    </div>
  );
}
