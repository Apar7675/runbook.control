import Link from "next/link";
import React from "react";

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

export default function SideNav({ isPlatformAdmin }: { isPlatformAdmin: boolean }) {
  return (
    <nav style={{ display: "grid", gap: 10 }}>
      {isPlatformAdmin ? (
        <div style={{ marginBottom: 2 }}>
          <Pill>Platform Admin</Pill>
        </div>
      ) : null}

      <NavItem href="/dashboard" label="Dashboard" />
      <NavItem href="/shops" label="Shops" />
      <NavItem href="/devices" label="Devices" />
      <NavItem href="/updates" label="Updates" />
      <NavItem href="/updates/packages" label="Update Packages" />
      <NavItem href="/support" label="Support Bundles" />
      <NavItem href="/audit" label="Audit Log" />
      <NavItem href="/settings" label="Settings" />
    </nav>
  );
}
