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
import { theme } from "@/lib/ui/theme";

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
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: theme.bg.appGlow, color: theme.text.primary }}>
      <DeviceIdBootstrap />

      <header
        style={{
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
            alignItems: "flex-end",
            gap: 18,
            flexWrap: "wrap",
            padding: "16px 22px",
          }}
        >
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <Link href="/shops" style={{ textDecoration: "none", color: theme.text.secondary, fontWeight: 700 }}>
                Back to Shop List
              </Link>
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
                Shop Workspace
              </span>
            </div>
            <div style={{ fontWeight: 900, fontSize: 28, lineHeight: 1.06 }}>{shopName}</div>
            <div style={{ color: theme.text.secondary, fontSize: 13 }}>
              {email} - Manage the health, access, and setup of this shop without exposing platform internals.
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
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
            top: 24,
            boxShadow: theme.shadow.panel,
          }}
        >
          <SideNav isPlatformAdmin={isPlatformAdmin} mode="shop" shopId={shopId} shopName={shopName} />
        </aside>

        <main style={{ minWidth: 0, display: "grid", gap: 22 }}>
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
