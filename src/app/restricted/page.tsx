import React from "react";
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { isPlatformAdmin } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function RestrictedPage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = user?.id ? await isPlatformAdmin(user.id).catch(() => false) : false;

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "#070A0F",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 760,
          display: "grid",
          gap: 16,
          padding: 28,
          borderRadius: 24,
          border: "1px solid rgba(148, 163, 184, 0.16)",
          background: "linear-gradient(180deg, rgba(16, 23, 34, 0.96), rgba(11, 16, 24, 0.98))",
          color: "#F8FAFC",
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: "#64748B" }}>
          RunBook Control
        </div>
        <h1 style={{ margin: 0, fontSize: 30, lineHeight: 1.1 }}>Platform administrators only</h1>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7, color: "#CBD5E1" }}>
          RunBook Control is restricted to platform administrators. Customer setup is completed from RunBook Desktop.
        </p>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: "#94A3B8" }}>
          Control stores cloud/admin data such as shop identity, billing outcomes, access decisions, update metadata, and support telemetry like device capability snapshots. It is not a customer portal and it does not own Desktop manufacturing files or Service runtime truth.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {admin ? (
            <Link
              href="/dashboard"
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                background: "#2563EB",
                color: "#F8FAFC",
                textDecoration: "none",
                fontWeight: 700,
              }}
            >
              Open Command Center
            </Link>
          ) : (
            <Link
              href="/login"
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                background: "#2563EB",
                color: "#F8FAFC",
                textDecoration: "none",
                fontWeight: 700,
              }}
            >
              Return to login
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
