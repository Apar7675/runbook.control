"use client";

import React from "react";
import Link from "next/link";
import GlassCard from "@/components/GlassCard";

export const dynamic = "force-dynamic";

export default function SignupPage() {
  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 520 }}>
      <h1 style={{ margin: 0, fontSize: 28 }}>Control Admin Signup Unavailable</h1>

      <GlassCard title="Use Desktop onboarding for RunBook accounts">
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ fontSize: 14, lineHeight: 1.5, opacity: 0.88 }}>
            The Control admin portal does not offer self-serve signup. Platform-admin portal access is restricted, and normal RunBook user accounts should be created in RunBook Desktop onboarding.
          </div>

          <Link
            href="/login"
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              fontWeight: 900,
              width: "fit-content",
              textDecoration: "none",
              color: "inherit",
              border: "1px solid rgba(255,255,255,0.18)",
            }}
          >
            Back to login
          </Link>
        </div>
      </GlassCard>
    </div>
  );
}
