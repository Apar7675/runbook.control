import React from "react";
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";

export default async function AuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 20px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(5,7,15,0.65)",
          backdropFilter: "blur(6px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Link
            href="/dashboard"
            style={{
              fontWeight: 800,
              textDecoration: "none",
              color: "#8b8cff",
              letterSpacing: 0.3,
            }}
          >
            RunBook.Control
          </Link>

          <span
            style={{
              fontSize: 13,
              opacity: 0.75,
            }}
          >
            {data.user?.email ?? ""}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link
            href="/dashboard"
            style={{
              textDecoration: "none",
              color: "#e6e8ef",
              opacity: 0.85,
              fontWeight: 500,
            }}
          >
            Dashboard
          </Link>

          <SignOutButton />
        </div>
      </header>

      {/* Page body */}
      <main
        style={{
          flex: 1,
          padding: 24,
        }}
      >
        {children}
      </main>
    </div>
  );
}
