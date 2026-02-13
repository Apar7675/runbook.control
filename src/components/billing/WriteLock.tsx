"use client";

import React from "react";
import { useBillingAccess } from "@/components/billing/BillingGate";
import type { BillingFeature } from "@/lib/billing/features";

export default function WriteLock(props: {
  feature: BillingFeature;
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}) {
  const access = useBillingAccess();

  // If allowed, render normally
  if (access.canWrite(props.feature)) {
    return <>{props.children}</>;
  }

  // Read-only overlay
  return (
    <div style={{ position: "relative" }}>
      <div style={{ pointerEvents: "none", opacity: 0.45 }}>
        {props.children}
      </div>

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          padding: 16,
        }}
      >
        <div
          style={{
            width: "min(520px, 100%)",
            borderRadius: 14,
            padding: 14,
            background: "rgba(10,12,20,0.85)",
            border: "1px solid rgba(120,130,170,0.25)",
            boxShadow: "0 10px 40px rgba(0,0,0,0.45)",
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 900 }}>
            {props.title ?? "Read-only mode"}
          </div>
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>
            {props.subtitle ?? "Billing is required to perform this action."}
          </div>
        </div>
      </div>
    </div>
  );
}
