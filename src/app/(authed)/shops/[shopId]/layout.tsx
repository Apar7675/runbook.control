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

function getGateMode(): BillingGateMode {
  const m = (process.env.RUNBOOK_BILLING_GATE_MODE ?? "").trim().toLowerCase();
  if (m === "hard" || m === "soft" || m === "hybrid") return m;
  return "hybrid";
}

function getGraceDays(): number {
  const v = Number.parseInt(process.env.RUNBOOK_BILLING_GRACE_DAYS ?? "14", 10);
  if (!Number.isFinite(v) || v < 0 || v > 120) return 14;
  return v;
}

function getEmergencyUnlock(): boolean {
  const s = (process.env.RUNBOOK_BILLING_EMERGENCY_UNLOCK ?? "false").trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

function getUnlockShopsCsv(): string {
  return (process.env.RUNBOOK_BILLING_UNLOCK_SHOPS ?? "").trim();
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
  const unlockShopsCsv = getUnlockShopsCsv();

  // Allow /billing to always render (even hard mode), so users can subscribe/cancel.
  const h = await headers();
  const nextUrl = h.get("next-url") ?? "";
  const isBillingPath = nextUrl.includes(`/shops/${shopId}/billing`);

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
            href="/shops"
            style={{
              textDecoration: "none",
              color: "#e6e8ef",
              opacity: 0.85,
              fontWeight: 900,
              whiteSpace: "nowrap",
            }}
          >
            ← Back to Platform
          </Link>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 900, opacity: 0.95 }}>{shopName}</span>
            <Pill>Shop Workspace</Pill>
            <span style={{ fontSize: 12, opacity: 0.65 }}>{email}</span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Link href="/status" style={{ textDecoration: "none", color: "#e6e8ef", opacity: 0.85 }}>
            Status
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
          <SideNav isPlatformAdmin={isPlatformAdmin} mode="shop" shopId={shopId} shopName={shopName} />
        </aside>

        <main style={{ minWidth: 0 }}>
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
