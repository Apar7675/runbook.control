import React from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";
import DeviceIdBootstrap from "@/components/DeviceIdBootstrap";
import { buildControlHeaderStatuses, toneForHealth } from "@/lib/connection-status";
import { resolveOnboardingPathForCurrentUser } from "@/lib/onboarding/flow";
import ControlSidebarV2 from "@/components/control/v2/ControlSidebarV2";
import ControlTopbarV2 from "@/components/control/v2/ControlTopbarV2";
import { controlV2Theme as t } from "@/components/control/v2/controlV2Theme";

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
  const headerStatusesRaw = buildControlHeaderStatuses({
    hasSession: !!session,
    hasUser: !!user,
    dataHealthy: !adminError,
    dataReason: adminError?.message,
  });
  const headerStatuses = headerStatusesRaw.map((status) => ({
    key: status.key,
    label: status.label,
    health: status.health === "Healthy" ? "healthy" : status.health === "Degraded" ? "warning" : "critical",
  }));

  if (isPlatformAdmin && aal !== "aal2") {
    const trusted = await isTrustedDevice(supabase, user.id);
    if (!trusted) redirect("/mfa");
  }

  const { path: onboardingPath } = await resolveOnboardingPathForCurrentUser();
  if (onboardingPath !== "/shops") {
    redirect(onboardingPath);
  }

  return (
    <div
      style={{
        position: "relative",
        isolation: "isolate",
        minHeight: "100vh",
        background: t.color.app,
        color: t.color.text,
      }}
    >
      <DeviceIdBootstrap />
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          backgroundColor: "#05080e",
          backgroundImage: "url('/control-space-bg.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          opacity: 0.12,
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          background: "rgba(5, 8, 14, 0.78)",
        }}
      />
      <div
        style={{
          position: "relative",
          zIndex: 1,
          minHeight: "100vh",
          display: "grid",
          gridTemplateColumns: `${t.spacing.railWidth}px minmax(0, 1fr)`,
        }}
      >
        <aside>
          <ControlSidebarV2 isPlatformAdmin={isPlatformAdmin} />
        </aside>

        <div style={{ minWidth: 0, display: "grid", gridTemplateRows: `${t.spacing.topbarHeight}px minmax(0, 1fr)` }}>
          <ControlTopbarV2
            email={email}
            roleLabel={isPlatformAdmin ? "Platform admin" : "Shop admin"}
            statuses={headerStatuses}
          />

          <main
            style={{
              minWidth: 0,
              display: "grid",
              alignContent: "start",
              gap: 14,
              padding: "18px 20px 24px",
            }}
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
