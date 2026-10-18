import React from "react";
import ProductionControlShell from "@/components/control/ProductionControlShell";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";
import SideNav from "@/components/SideNav";
import DeviceIdBootstrap from "@/components/DeviceIdBootstrap";
import HeaderDateTime from "@/components/HeaderDateTime";
import { buildControlHeaderStatuses, toneForHealth } from "@/lib/connection-status";
import { resolveOnboardingPathForCurrentUser } from "@/lib/onboarding/flow";

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
    <ProductionControlShell
      email={email}
      isPlatformAdmin={isPlatformAdmin}
      statuses={headerStatuses}
      navigation={<SideNav isPlatformAdmin={isPlatformAdmin} mode="platform" />}
      sessionControls={<>
        {headerStatuses.map((status) => <StatusPill key={status.key} status={status} />)}
        <HeaderDateTime />
        <SignOutButton />
      </>}
    >
      <DeviceIdBootstrap />
      {children}
    </ProductionControlShell>
  );
}
