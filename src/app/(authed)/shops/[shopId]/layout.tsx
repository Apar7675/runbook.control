import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";
import DeviceIdBootstrap from "@/components/DeviceIdBootstrap";
import { rbGetShop } from "@/lib/rb";
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

  return (
    <div
      style={{
        minHeight: 0,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        background: "transparent",
        color: theme.text.primary,
      }}
    >
      <DeviceIdBootstrap />

      <header
        style={{
          border: theme.border.soft,
          borderRadius: theme.radius.md,
          background: theme.bg.header,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: 2,
            background: theme.text.accent,
          }}
        />
        <div
          style={{
            maxWidth: theme.spacing.contentWidth,
            width: "100%",
            boxSizing: "border-box",
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            padding: "10px 14px",
            fontSize: 12.5,
          }}
        >
          <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <Link
                href="/shops"
                style={{ color: theme.text.accent, textDecoration: "none", fontWeight: 600 }}
              >
                Back to Shop List
              </Link>
              <span
                style={{
                  display: "inline-flex",
                  padding: "3px 8px",
                  borderRadius: theme.radius.pill,
                  border: theme.border.soft,
                  background: theme.bg.panelSoft,
                  color: theme.text.accentSoft,
                  fontWeight: 600,
                  fontSize: 11,
                }}
              >
                Shop Workspace
              </span>
            </div>
            <div
              style={{
                color: theme.text.muted,
                fontSize: 12,
                lineHeight: 1.4,
                maxWidth: 760,
                overflowWrap: "anywhere",
              }}
            >
              {email} · Manage access, billing, devices and support for {shopName}.
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <Link
              href="/status"
              style={{ color: theme.text.accent, textDecoration: "none", fontWeight: 600 }}
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
          padding: "14px 0 0",
          display: "block",
        }}
      >
        <div style={{ minWidth: 0, display: "grid", gap: 14 }}>
          {/* The parent layout authenticates platform admins. Shop billing must stay
              reachable here so admins can restore access for an expired shop. */}
          {children}
        </div>
      </div>
    </div>
  );
}
