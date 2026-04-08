import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";
import SideNav from "@/components/SideNav";
import DeviceIdBootstrap from "@/components/DeviceIdBootstrap";
import { rbGetShop } from "@/lib/rb";
import { BillingGate, BillingGateMode } from "@/components/billing/BillingGate";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function isTrustedDevice(supabase: any, userId: string) {
  try {
    const jar: any = await cookies();
    const deviceId = jar?.get?.("rb_device_id")?.value ?? "";
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

function getGateMode(): BillingGateMode {
  const mode = (process.env.RUNBOOK_BILLING_GATE_MODE ?? "").trim().toLowerCase();
  if (mode === "hard" || mode === "soft" || mode === "hybrid") return mode;
  return "hybrid";
}

function getGraceDays() {
  const value = Number.parseInt(process.env.RUNBOOK_BILLING_GRACE_DAYS ?? "14", 10);
  if (!Number.isFinite(value) || value < 0 || value > 120) return 14;
  return value;
}

function getEmergencyUnlock() {
  const raw = (process.env.RUNBOOK_BILLING_EMERGENCY_UNLOCK ?? "false").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

type Props = {
  params: Promise<{ shopId: string }>;
  children: React.ReactNode;
};

export default async function ShopLayout({ params, children }: Props) {
  const { shopId } = await params;
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

  if (isPlatformAdmin && aal !== "aal2") {
    const trusted = await isTrustedDevice(supabase, user.id);
    if (!trusted) redirect("/mfa");
  }

  const shop = await rbGetShop(shopId);
  const shopName = shop?.name ?? "Shop";

  const gateMode = getGateMode();
  const graceDays = getGraceDays();
  const emergencyUnlock = getEmergencyUnlock();
  const unlockShopsCsv = (process.env.RUNBOOK_BILLING_UNLOCK_SHOPS ?? "").trim();

  const requestHeaders: any = await headers();
  const path = requestHeaders?.get?.("x-url") ?? requestHeaders?.get?.("x-original-url") ?? requestHeaders?.get?.("next-url") ?? "";
  const isBillingPath = String(path).includes(`/shops/${shopId}/billing`);

  return (
    <div className="rb-appRoot">
      <DeviceIdBootstrap />

      <header className="rb-topbar">
        <div className="rb-topbarAccent" />
        <div className="rb-topbarInner">
          <div className="rb-brandBlock">
            <div className="rb-brandEyebrow">Shop Workspace</div>
            <div className="rb-inlineRow">
              <Link href="/shops" className="rb-buttonLink rb-buttonLink--ghost">
                Back to Shop List
              </Link>
              <span className="rb-rolePill">RunBook Shop</span>
            </div>
            <div className="rb-brandTitle">{shopName}</div>
            <div className="rb-brandSubtitle">
              Shop-level workspace for health, access, devices, and release posture without exposing platform-only internals.
            </div>
            <div className="rb-shellMeta">
              <span className="rb-fine">{email}</span>
            </div>
          </div>

          <div className="rb-shellMeta" style={{ justifyContent: "flex-end" }}>
            <Link href="/status" className="rb-buttonLink rb-buttonLink--ghost">
              Status
            </Link>
            <SignOutButton />
          </div>
        </div>
      </header>

      <div className="rb-shellGrid">
        <aside className="rb-sidebar">
          <SideNav isPlatformAdmin={isPlatformAdmin} mode="shop" shopId={shopId} shopName={shopName} />
        </aside>

        <main className="rb-main">
          {isBillingPath ? (
            children
          ) : (
            <BillingGate
              shopId={shopId}
              mode={gateMode}
              graceDays={graceDays}
              emergencyUnlock={emergencyUnlock}
              unlockShopsCsv={unlockShopsCsv}
            >
              {children}
            </BillingGate>
          )}
        </main>
      </div>
    </div>
  );
}
