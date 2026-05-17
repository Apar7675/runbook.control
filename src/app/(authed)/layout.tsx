import React from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";
import ControlAppShell from "@/components/control/ControlAppShell";
import type { ControlStatusTone } from "@/components/control/ControlStatusChip";
import DeviceIdBootstrap from "@/components/DeviceIdBootstrap";
import { buildControlHeaderStatuses } from "@/lib/connection-status";
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
  const headerStatuses: Array<{ key: string; label: string; tone: ControlStatusTone }> = headerStatusesRaw.map((status) => ({
    key: status.key,
    label: status.label,
    tone: status.health === "Healthy" ? "success" : status.health === "Degraded" ? "warning" : "danger",
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
    <>
      <DeviceIdBootstrap />
      <ControlAppShell
        email={email}
        roleLabel={isPlatformAdmin ? "Platform admin" : "Shop admin"}
        statuses={headerStatuses}
      >
        {children}
      </ControlAppShell>
    </>
  );
}
