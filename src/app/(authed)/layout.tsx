import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";
import SideNav from "@/components/SideNav";
import DeviceIdBootstrap from "@/components/DeviceIdBootstrap";
import HeaderDateTime from "@/components/HeaderDateTime";
import { buildControlHeaderStatuses, toneForHealth } from "@/lib/connection-status";
import { resolveOnboardingPathForCurrentUser } from "@/lib/onboarding/flow";
import { theme } from "@/lib/ui/theme";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function isTrustedDevice(supabase: any, userId: string) {
  try {
    const jar = await cookies();
    const deviceId = jar.get("rb_device_id")?.value ?? "";
    if (!deviceId) return false;

    const { data: row } = await supabase
      .from("rb_trusted_devices")
      .select("trusted_until")
      .eq("user_id", userId)
      .eq("device_id", deviceId)
      .maybeSingle();

    if (!row?.trusted_until) return false;
    return new Date(row.trusted_until).getTime() > Date.now();
  } catch {
    return false;
  }
}

function StatusPill({ status }: { status: ReturnType<typeof buildControlHeaderStatuses>[number] }) {
  const tone = toneForHealth(status.health);
  return (
    <span
      title={status.reason}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        minHeight: 30,
        padding: "6px 11px",
        borderRadius: 999,
        border: `1px solid ${tone.borderColor}`,
        background: "rgba(10,16,25,0.84)",
        boxShadow: `0 0 0 1px ${tone.borderColor} inset, 0 0 16px ${tone.borderColor.replace("0.34", "0.14")}`,
        color: "#eef3fa",
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: 0.45,
        textTransform: "uppercase",
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: tone.dot,
        }}
      />
      {status.label}
    </span>
  );
}

export default async function AuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await supabaseServer();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const email = user.email ?? "";
  const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const aal = (aalData?.currentLevel as "aal1" | "aal2" | "aal3" | null) ?? "aal1";

  const { data: row, error: adminError } = await supabase
    .from("rb_control_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const isPlatformAdmin = !!row;
  const headerStatuses = buildControlHeaderStatuses({
    hasSession: !!session,
    hasUser: !!user,
    dataHealthy: !adminError,
    dataReason: adminError?.message,
  });

  if (isPlatformAdmin && aal !== "aal2") {
    const trusted = await isTrustedDevice(supabase, user.id);
    if (!trusted) redirect("/mfa");
  }

  const { path: onboardingPath } = await resolveOnboardingPathForCurrentUser();
  if (onboardingPath !== "/dashboard") {
    redirect(onboardingPath);
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: theme.bg.appGlow,
        color: theme.text.primary,
      }}
    >
      <DeviceIdBootstrap />

      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          background: "linear-gradient(180deg, rgba(8,11,18,0.94), rgba(8,11,18,0.86))",
          backdropFilter: "blur(16px)",
        }}
      >
        <div
          style={{
            height: 3,
            background: "linear-gradient(90deg, rgba(79,102,255,0.9), rgba(68,177,255,0.72), rgba(167,188,255,0.24))",
          }}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 18,
            flexWrap: "wrap",
            padding: "16px 22px",
          }}
        >
          <div style={{ display: "grid", gap: 8 }}>
            <Link href="/dashboard" style={{ textDecoration: "none", color: theme.text.primary }}>
              <div style={{ fontWeight: 900, fontSize: 22, letterSpacing: 0.2 }}>RunBook Control</div>
            </Link>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ color: theme.text.secondary, fontSize: 13 }}>{email}</span>
              <span
                style={{
                  display: "inline-flex",
                  padding: "6px 10px",
                  borderRadius: 999,
                  border: "1px solid rgba(146, 163, 255, 0.22)",
                  background: "rgba(92, 108, 255, 0.15)",
                  color: "#d6ddff",
                  fontWeight: 900,
                  fontSize: 11,
                  letterSpacing: 0.6,
                  textTransform: "uppercase",
                }}
              >
                {isPlatformAdmin ? "Platform Admin" : "Shop Admin"}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {headerStatuses.map((status) => (
                <StatusPill key={status.key} status={status} />
              ))}
            </div>
            <HeaderDateTime />
            <Link href="/status" style={{ textDecoration: "none", color: theme.text.secondary, fontWeight: 700 }}>
              Status
            </Link>
            <SignOutButton />
          </div>
        </div>
      </header>

      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "320px minmax(0, 1fr)",
          gap: 22,
          padding: 22,
        }}
      >
        <aside
          style={{
            border: theme.border.soft,
            borderRadius: 22,
            background: theme.bg.panel,
            padding: 18,
            height: "fit-content",
            position: "sticky",
            top: 96,
            boxShadow: theme.shadow.panel,
          }}
        >
          <SideNav isPlatformAdmin={isPlatformAdmin} mode="platform" />
        </aside>

        <main style={{ minWidth: 0, display: "grid", gap: 22 }}>{children}</main>
      </div>
    </div>
  );
}
