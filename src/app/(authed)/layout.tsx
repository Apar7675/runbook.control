import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";
import ControlAppShell from "@/components/control/ControlAppShell";
import type { ControlStatusTone } from "@/components/control/ControlStatusChip";
import { getViewerContext, type ViewerContext } from "@/lib/control/summary";
import DeviceIdBootstrap from "@/components/DeviceIdBootstrap";
import { buildControlHeaderStatuses } from "@/lib/connection-status";
import { isPlatformAdmin } from "@/lib/authz";

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
  const isAdmin = await isPlatformAdmin(user.id);
  const headerStatusesRaw = buildControlHeaderStatuses({
    hasSession: !!session,
    hasUser: !!user,
    dataHealthy: true,
  });
  const headerStatuses: Array<{ key: string; label: string; tone: ControlStatusTone }> = headerStatusesRaw.map((status) => ({
    key: status.key,
    label: status.label,
    tone: status.health === "Healthy" ? "success" : status.health === "Degraded" ? "warning" : "danger",
  }));

  if (!isAdmin) {
    redirect("/restricted");
  }

  if (aal !== "aal2") {
    const trusted = await isTrustedDevice(supabase, user.id);
    if (!trusted) redirect("/mfa");
  }

  let companyContext: ViewerContext | null = null;
  let companyError: string | null = null;
  try { companyContext = await getViewerContext(); } catch { companyError = "Companies could not be loaded."; }

  return (
    <>
      <DeviceIdBootstrap />
      <ControlAppShell
        email={email}
        roleLabel="Platform admin"
        statuses={headerStatuses}
        selectedCompanyId={companyContext?.selectedCompanyId ?? null}
      >
        {companyError || companyContext?.companyUnavailable ? <section role="alert" style={{ padding: 16, border: "1.25px solid #5E7DA5", borderRadius: 9, background: "#FFFFFF" }}><h1 style={{ marginTop: 0, fontSize: 24 }}>Company unavailable</h1><p>{companyError ?? "This shop is no longer available to this session. Open Shops to choose an available shop."}</p><Link href="/shops" prefetch={false}>Open Shops</Link></section> : children}
      </ControlAppShell>
    </>
  );
}
