// REPLACE ENTIRE FILE: src/app/(authed)/layout.tsx

import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";
import SideNav from "@/components/SideNav";
import DeviceIdBootstrap from "@/components/DeviceIdBootstrap";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "5px 10px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.16)",
        background: "rgba(139,140,255,0.16)",
        color: "#b8b9ff",
        fontWeight: 900,
        fontSize: 12,
        letterSpacing: 0.4,
        textTransform: "uppercase",
      }}
    >
      {children}
    </span>
  );
}

async function isTrustedDevice(supabase: any, userId: string) {
  try {
    // Next 15/Turbopack: cookies() is async in your environment
    const jar = await cookies();
    const deviceId = jar.get("rb_device_id")?.value ?? "";
    if (!deviceId) return false;

    // Uses RLS policy: user_id = auth.uid()
    const { data: row, error } = await supabase
      .from("rb_trusted_devices")
      .select("trusted_until")
      .eq("user_id", userId)
      .eq("device_id", deviceId)
      .maybeSingle();

    if (error) return false;
    if (!row?.trusted_until) return false;

    return new Date(row.trusted_until).getTime() > Date.now();
  } catch {
    // Never crash dashboard because of trust logic
    return false;
  }
}

export default async function AuthedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await supabaseServer();

  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user ?? null;
  if (!user) redirect("/login");

  const email = user.email ?? "";

  const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const aal = (aalData?.currentLevel as "aal1" | "aal2" | "aal3" | null) ?? "aal1";

  const { data: row } = await supabase
    .from("rb_control_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const isPlatformAdmin = !!row;

  // Enforce MFA for platform admins; allow trusted-device skip
  if (isPlatformAdmin && aal !== "aal2") {
    const trusted = await isTrustedDevice(supabase, user.id);
    if (!trusted) redirect("/mfa");
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <DeviceIdBootstrap />

      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 20px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(5,7,15,0.65)",
          backdropFilter: "blur(8px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Link
            href="/dashboard"
            style={{
              fontWeight: 900,
              textDecoration: "none",
              color: "#8b8cff",
              letterSpacing: 0.3,
            }}
          >
            RunBook.Control
          </Link>

          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 13, opacity: 0.75 }}>{email}</span>
              {isPlatformAdmin ? <Pill>Platform Admin</Pill> : null}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Link href="/dashboard" style={{ textDecoration: "none", color: "#e6e8ef", opacity: 0.85 }}>
            Dashboard
          </Link>
          <SignOutButton />
        </div>
      </header>

      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "260px 1fr",
          gap: 18,
          padding: 18,
        }}
      >
        <aside
          style={{
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 16,
            background: "rgba(255,255,255,0.03)",
            padding: 14,
            height: "fit-content",
            position: "sticky",
            top: 18,
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 10, letterSpacing: 0.4 }}>
            NAVIGATION
          </div>

          <SideNav isPlatformAdmin={isPlatformAdmin} />

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.6 }}>
            Security: Platform admins must verify MFA.{" "}
            <Link href="/settings" style={{ color: "#b8b9ff", textDecoration: "none" }}>
              Manage MFA
            </Link>
          </div>
        </aside>

        <main style={{ minWidth: 0 }}>{children}</main>
      </div>
    </div>
  );
}
