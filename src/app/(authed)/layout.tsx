import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";
import SideNav from "@/components/SideNav";
import DeviceIdBootstrap from "@/components/DeviceIdBootstrap";
import HeaderDateTime from "@/components/HeaderDateTime";
import { ShellStatusBadge, toneFromStatus } from "@/components/control/ui";
import { buildControlHeaderStatuses } from "@/lib/connection-status";

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

export default async function AuthedLayout({ children }: { children: React.ReactNode }) {
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

  if (!isPlatformAdmin) {
    redirect("/onboarding/complete");
  }

  return (
    <div className="rb-appRoot">
      <DeviceIdBootstrap />

      <header className="rb-topbar">
        <div className="rb-topbarAccent" />
        <div className="rb-topbarInner">
          <div className="rb-brandBlock">
            <div className="rb-brandEyebrow">RunBook Product Family</div>
            <Link href="/dashboard" className="rb-brandLink">
              <div className="rb-brandTitle">RunBook Control</div>
            </Link>
            <div className="rb-brandSubtitle">
              Premium admin control center for fleet health, billing authority, release operations, and support posture.
            </div>
            <div className="rb-shellMeta">
              <span className="rb-fine">{email}</span>
              <span className="rb-rolePill">{isPlatformAdmin ? "Platform Admin" : "Shop Admin"}</span>
            </div>
          </div>

          <div className="rb-shellMeta" style={{ justifyContent: "flex-end" }}>
            {headerStatuses.map((status) => (
              <div key={status.key} title={status.reason}>
                <ShellStatusBadge label={status.label} tone={toneFromStatus(status.health)} />
              </div>
            ))}
            <HeaderDateTime />
            <Link href="/status" className="rb-buttonLink rb-buttonLink--ghost">
              Status
            </Link>
            <SignOutButton />
          </div>
        </div>
      </header>

      <div className="rb-shellGrid">
        <aside className="rb-sidebar">
          <SideNav isPlatformAdmin={isPlatformAdmin} mode="platform" />
        </aside>
        <main className="rb-main">{children}</main>
      </div>
    </div>
  );
}
