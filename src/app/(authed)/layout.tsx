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
          background: "linear-gradient(180deg, rgba(10,16,24,0.96), rgba(8,12,19,0.90))",
          backdropFilter: "blur(16px)",
          boxShadow: "0 18px 40px rgba(0,0,0,0.22)",
        }}
      >
        <div
          style={{
            height: 3,
            background: "linear-gradient(90deg, rgba(126,171,217,0.92), rgba(94,132,198,0.76), rgba(226,174,88,0.30))",
          }}
        />
        <div
          style={{
            maxWidth: 1580,
            width: "100%",
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 14,
            flexWrap: "wrap",
            padding: "12px 18px",
          }}
        >
          <div style={{ display: "grid", gap: 6 }}>
            <Link href="/dashboard" style={{ textDecoration: "none", color: theme.text.primary }}>
              <div style={{ fontWeight: 900, fontSize: 20, letterSpacing: -0.18 }}>RunBook Control</div>
            </Link>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ color: theme.text.muted, fontSize: 13 }}>{email}</span>
              <span
                style={{
                  display: "inline-flex",
                  padding: "6px 10px",
                  borderRadius: 999,
                  border: theme.border.accentSoft,
                  background: "rgba(126, 171, 217, 0.12)",
                  color: theme.text.accentSoft,
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
          gridTemplateColumns: "280px minmax(0, 1fr)",
          gap: 16,
          padding: 16,
          maxWidth: 1480,
          width: "100%",
          margin: "0 auto",
        }}
      >
        <aside
          style={{
            border: theme.border.accentSoft,
            borderRadius: 18,
            background: theme.bg.nav,
            padding: 14,
            height: "fit-content",
            position: "sticky",
            top: 82,
            boxShadow: theme.shadow.glowSoft,
          }}
        >
          <SideNav isPlatformAdmin={isPlatformAdmin} mode="platform" />
        </aside>

        <main style={{ minWidth: 0, display: "grid", gap: 16, alignContent: "start" }}>{children}</main>
      </div>
    </div>
  );
}
