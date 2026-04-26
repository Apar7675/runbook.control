import React from "react";
import Link from "next/link";
import ControlBadgeV2, { toneFromStatusV2 } from "@/components/control/v2/ControlBadgeV2";
import { controlV2Theme as t } from "@/components/control/v2/controlV2Theme";
import type { ShopSnapshot } from "@/lib/control/summary";

export default function ShopHeaderV2({
  snapshot,
}: {
  snapshot: ShopSnapshot;
}) {
  const billingLabel = snapshot.billing_status ? snapshot.billing_status.replace(/_/g, " ") : "billing unknown";

  return (
    <div style={{ display: "grid", gap: 10, paddingBottom: 10, borderBottom: `1px solid ${t.color.border}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ color: t.color.textQuiet, ...t.type.label }}>Shop Workspace</div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: -0.44, lineHeight: 1.04 }}>{snapshot.name}</h1>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Link
            href="/shops"
            style={{
              display: "inline-flex",
              alignItems: "center",
              minHeight: 30,
              padding: "5px 9px",
              borderRadius: t.radius.sm,
              textDecoration: "none",
              border: `1px solid ${t.color.border}`,
              background: t.color.surface,
              color: t.color.textMuted,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            Back to shops
          </Link>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <ControlBadgeV2 label={snapshot.access.display_status} tone={toneFromStatusV2(snapshot.access.display_status)} />
        <ControlBadgeV2 label={billingLabel} tone={toneFromStatusV2(billingLabel)} />
        <ControlBadgeV2 label={snapshot.member_role.replace(/_/g, " ")} tone="neutral" />
        {snapshot.trial_ends_at ? <ControlBadgeV2 label={`trial ${new Date(snapshot.trial_ends_at).toLocaleDateString("en-US", { month: "short", day: "2-digit" })}`} tone="warning" /> : null}
        {snapshot.grace_ends_at ? <ControlBadgeV2 label={`grace ${new Date(snapshot.grace_ends_at).toLocaleDateString("en-US", { month: "short", day: "2-digit" })}`} tone="warning" /> : null}
      </div>
    </div>
  );
}
