import React from "react";
import { ActionLink, DataList, EmptyState, PageHeader, SectionBlock } from "@/components/control/ui";
import { rbGetShop, rbGetUpdatePolicy } from "@/lib/rb";
import { formatDateTime } from "@/lib/ui/dates";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ shopId: string }>;
};

export default async function ShopPolicyPage({ params }: Props) {
  const { shopId } = await params;
  const shop = await rbGetShop(shopId);

  if (!shop) {
    return (
      <div style={{ display: "grid", gap: 20 }}>
        <PageHeader eyebrow="Updates" title="Update Policy" description="The requested shop was not found or is no longer available." />
        <EmptyState title="Shop not available" description="Return to the shop list and select another workspace." action={<ActionLink href="/shops" tone="primary">Back to Shops</ActionLink>} />
      </div>
    );
  }

  const policy = await rbGetUpdatePolicy(shop.id);

  return (
    <div style={{ display: "grid", gap: 22 }}>
      <PageHeader
        eyebrow="Updates"
        title={`Update Policy for ${shop.name}`}
        description="Summarize rollout rules in plain English first, then show the technical fields only as supporting detail."
        actions={<ActionLink href="/updates" tone="primary">Back to Updates</ActionLink>}
      />

      <SectionBlock title="Current Policy" description="This page remains read-only until the consolidated policy editor is added.">
        {!policy ? (
          <EmptyState title="No rollout policy yet" description="This shop is still using the default update behavior. Add a policy when you need a rollout channel or version gate." />
        ) : (
          <DataList
            items={[
              { label: "Channel", value: policy.channel || "stable" },
              { label: "Minimum Version", value: policy.min_version || "Not set" },
              { label: "Pinned Version", value: policy.pinned_version || "Not set" },
              { label: "Last Updated", value: policy.created_at ? formatDateTime(policy.created_at) : "Unknown" },
            ]}
          />
        )}
      </SectionBlock>
    </div>
  );
}
