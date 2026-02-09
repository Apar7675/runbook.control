import Link from "next/link";
import React from "react";

type Mode = "platform" | "shop";

function NavItem({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      style={{
        display: "block",
        padding: "10px 12px",
        borderRadius: 12,
        textDecoration: "none",
        color: "#e6e8ef",
        opacity: 0.9,
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.03)",
      }}
    >
      {label}
    </Link>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "6px 10px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.16)",
        background: "rgba(139,140,255,0.16)",
        color: "#b8b9ff",
        fontWeight: 900,
        fontSize: 12,
        letterSpacing: 0.4,
        textTransform: "uppercase",
        width: "fit-content",
      }}
    >
      {children}
    </span>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12, opacity: 0.65, letterSpacing: 0.4, margin: "6px 0 0" }}>
      {children}
    </div>
  );
}

export default function SideNav(props: {
  isPlatformAdmin: boolean;
  mode?: Mode;
  shopId?: string | null;
  shopName?: string | null;
}) {
  const { isPlatformAdmin, mode = "platform", shopId, shopName } = props;

  if (mode === "shop" && shopId) {
    return (
      <nav style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "grid", gap: 8, marginBottom: 2 }}>
          <Pill>Shop Workspace</Pill>
          <div style={{ fontWeight: 900, opacity: 0.9 }}>{shopName ?? "Shop"}</div>
        </div>

        <SectionTitle>SHOP</SectionTitle>
        <NavItem href={`/shops/${shopId}`} label="Overview" />
        <NavItem href={`/shops/${shopId}/devices`} label="Devices" />
        <NavItem href={`/shops/${shopId}/policy`} label="Update Policy" />
        <NavItem href={`/shops/${shopId}/billing`} label="Billing" />
        <NavItem href={`/shops/${shopId}/audit`} label="Audit" />

        <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "6px 0" }} />

        <SectionTitle>PLATFORM</SectionTitle>
        <NavItem href="/shops" label="All Shops" />
        <NavItem href="/devices" label="Global Devices" />
        <NavItem href="/status" label="Status" />
        <NavItem href="/settings" label="Settings" />
      </nav>
    );
  }

  return (
    <nav style={{ display: "grid", gap: 10 }}>
      {isPlatformAdmin ? (
        <div style={{ display: "grid", gap: 8, marginBottom: 2 }}>
          <Pill>Platform Control</Pill>
        </div>
      ) : null}

      <NavItem href="/dashboard" label="Platform Overview" />
      <NavItem href="/shops" label="All Shops" />
      <NavItem href="/devices" label="Global Devices" />
      <NavItem href="/updates" label="Updates" />
      <NavItem href="/updates/packages" label="Update Packages" />
      <NavItem href="/support" label="Support Bundles" />
      <NavItem href="/audit" label="Audit Log" />
      <NavItem href="/status" label="Status" />
      <NavItem href="/settings" label="Settings" />
    </nav>
  );
}
