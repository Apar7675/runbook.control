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

function StatusPill({
  status,
}: {
  status: ReturnType<typeof buildControlHeaderStatuses>[number];
}) {
  const tone = toneForHealth(status.health);
  return (
    <span
      title={status.reason}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        minHeight: 32,
        padding: "6px 11px",
        borderRadius: theme.radius.pill,
        border: `1px solid ${tone.borderColor}`,
        background: "linear-gradient(180deg, rgba(10,16,25,0.90), rgba(8,12,20,0.88))",
        boxShadow: `0 0 0 1px ${tone.borderColor} inset, 0 0 18px ${tone.borderColor.replace("0.34", "0.12")}`,
        color: "#eef3fa",
        fontSize: 10.5,
        fontWeight: 900,
        letterSpacing: 0.5,
        textTransform: "uppercase",
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: theme.radius.pill,
          background: tone.dot,
        }}
      />
      {status.label}
    </span>
  );
}

const mobileBreak: React.CSSProperties = {
  paddingLeft: 16,
  paddingRight: 16,
};

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
          borderBottom: theme.border.accentSoft,
          background: theme.bg.headerGlass,
          backdropFilter: "blur(18px)",
          boxShadow: "0 18px 40px rgba(0, 0, 0, 0.22)",
        }}
      >
        <div
          style={{
            height: 3,
            background:
              "linear-gradient(90deg, rgba(126,171,217,0.92), rgba(94,132,198,0.76), rgba(153,123,255,0.58))",
          }}
        />
        <div
          style={{
            maxWidth: theme.spacing.contentWidth,
            width: "100%",
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 18,
            flexWrap: "wrap",
            padding: `16px ${theme.spacing.shellX}px`,
          }}
        >
          <div style={{ display: "grid", gap: 8, minWidth: 0 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "6px 10px",
                  borderRadius: theme.radius.pill,
                  border: "1px solid rgba(146, 163, 255, 0.22)",
                  background: "rgba(92, 108, 255, 0.13)",
                  color: theme.text.accentSoft,
                  fontSize: 10,
                  fontWeight: 900,
                  letterSpacing: 0.7,
                  textTransform: "uppercase",
                }}
              >
                {isPlatformAdmin ? "Platform Admin" : "Shop Admin"}
              </span>
              <span style={{ color: theme.text.muted, fontSize: 12.5 }}>{email}</span>
            </div>
            <Link
              href="/dashboard"
              style={{
                color: theme.text.primary,
                textDecoration: "none",
                fontSize: 25,
                fontWeight: 800,
                letterSpacing: -0.5,
                lineHeight: 1.02,
              }}
            >
              RunBook Control
            </Link>
            <div
              style={{
                color: theme.text.secondary,
                fontSize: 13,
                lineHeight: 1.55,
                maxWidth: 720,
              }}
            >
              Premium command visibility across health, people, devices, billing,
              and connectivity.
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              flexWrap: "wrap",
              justifyContent: "flex-end",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                justifyContent: "flex-end",
              }}
            >
              {headerStatuses.map((status) => (
                <StatusPill key={status.key} status={status} />
              ))}
            </div>
            <HeaderDateTime />
            <Link
              href="/status"
              style={{
                color: theme.text.secondary,
                textDecoration: "none",
                fontWeight: 800,
                padding: "0 2px",
              }}
            >
              Status
            </Link>
            <SignOutButton />
          </div>
        </div>
      </header>

      <div
        style={{
          flex: 1,
          width: "100%",
          maxWidth: theme.spacing.contentWidth,
          margin: "0 auto",
          padding: `${theme.spacing.shellY}px ${theme.spacing.shellX}px ${theme.spacing.xxl}px`,
          display: "grid",
          gridTemplateColumns: `${theme.spacing.navWidth}px minmax(0, 1fr)`,
          gap: 20,
          alignItems: "start",
        }}
      >
        <aside
          style={{
            position: "sticky",
            top: 108,
            padding: "20px 18px 18px",
            borderRadius: theme.radius.xl,
            border: theme.border.nav,
            background: theme.bg.nav,
            boxShadow: theme.shadow.nav,
            height: "fit-content",
            overflow: "hidden",
          }}
        >
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              background:
                "radial-gradient(circle at top left, rgba(122,157,214,0.12), transparent 28%), radial-gradient(circle at bottom left, rgba(120,105,255,0.08), transparent 24%)",
            }}
          />
          <div style={{ position: "relative", zIndex: 1 }}>
            <SideNav isPlatformAdmin={isPlatformAdmin} mode="platform" />
          </div>
        </aside>

        <main
          style={{
            minWidth: 0,
            display: "grid",
            gap: 18,
            alignContent: "start",
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
