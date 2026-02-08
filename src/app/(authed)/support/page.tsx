import React from "react";
import GlassCard from "@/components/GlassCard";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function SupportPage() {
  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 1100 }}>
      <h1 style={{ fontSize: 28, margin: 0 }}>Support Bundles</h1>

      <GlassCard title="What is a Support Bundle?">
        <div style={{ opacity: 0.85, lineHeight: 1.45 }}>
          A Support Bundle is a diagnostic export a shop can generate when something goes wrong. It should contain
          safe-to-share logs and metadata so you can troubleshoot fast.
        </div>
        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
          Note: This page exists to fix the 404 and provide a home for support features. We’ll wire in the actual bundle
          list/upload/download next.
        </div>
      </GlassCard>

      <GlassCard title="Next">
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ opacity: 0.85 }}>
            Recommended next steps:
            <ul style={{ marginTop: 6, opacity: 0.85 }}>
              <li>List bundles per shop (rb_support_bundles)</li>
              <li>Download bundle file from Storage</li>
              <li>Generate bundle from device / shop (future)</li>
            </ul>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link
              href="/shops"
              style={{
                textDecoration: "none",
                padding: "10px 14px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.05)",
                fontWeight: 900,
                color: "inherit",
              }}
            >
              Back to Shops
            </Link>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
