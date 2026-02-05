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

export default function SideNav() {
  return (
    <nav style={{ display: "grid", gap: 10 }}>
      <NavItem href="/dashboard" label="Dashboard" />
      <NavItem href="/shops" label="Shops" />
      <NavItem href="/devices" label="Devices" />
      <NavItem href="/updates" label="Updates" />
      <NavItem href="/updates/packages" label="Update Packages" />
      <NavItem href="/support" label="Support Bundles" />
    </nav>
  );
}
