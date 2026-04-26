"use client";

import Link from "next/link";
import React from "react";
import { usePathname } from "next/navigation";
import { controlV2Theme as t } from "@/components/control/v2/controlV2Theme";

function icon(name: string, active: boolean) {
  const stroke = active ? t.color.text : t.color.textQuiet;
  if (name === "shops") {
    return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.7"><path d="M4 10.5 12 4l8 6.5"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5h4v5"/></svg>;
  }
  if (name === "people") {
    return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.7"><circle cx="12" cy="9" r="3"/><path d="M17 19a5 5 0 0 0-10 0"/></svg>;
  }
  if (name === "devices") {
    return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.7"><rect x="4" y="5" width="16" height="10" rx="2"/><path d="M10 19h4"/><path d="M12 15v4"/></svg>;
  }
  if (name === "apps") {
    return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.7"><rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/></svg>;
  }
  if (name === "billing") {
    return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.7"><path d="M4 7h16"/><path d="M6 4h12l2 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8l2-4Z"/></svg>;
  }
  if (name === "updates") {
    return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.7"><path d="M12 4v8"/><path d="m8.5 8 3.5 4 3.5-4"/><rect x="4" y="15" width="16" height="5" rx="2"/></svg>;
  }
  if (name === "audit") {
    return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.7"><rect x="6" y="6" width="12" height="16" rx="2"/><path d="M9 11h6"/><path d="M9 15h6"/></svg>;
  }
  if (name === "status") {
    return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.7"><path d="M4 12h4l2-4 4 8 2-4h4"/></svg>;
  }
  if (name === "settings") {
    return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.7"><circle cx="12" cy="12" r="3.25"/><path d="M12 3.5v2.2"/><path d="M12 18.3v2.2"/><path d="M3.5 12h2.2"/><path d="M18.3 12h2.2"/></svg>;
  }
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.7"><circle cx="12" cy="12" r="8"/></svg>;
}

function isSelected(pathname: string, href: string) {
  if (href === "/shops") return pathname === "/shops" || pathname.startsWith("/shops/");
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavItem({
  href,
  label,
  iconName,
  pathname,
}: {
  href: string;
  label: string;
  iconName: string;
  pathname: string;
}) {
  const active = isSelected(pathname, href);
  return (
    <Link
      href={href}
      style={{
        display: "grid",
        gridTemplateColumns: "18px minmax(0, 1fr)",
        alignItems: "center",
        gap: 10,
        minHeight: 34,
        padding: "7px 10px",
        borderRadius: t.radius.sm,
        textDecoration: "none",
        color: active ? t.color.text : t.color.textMuted,
        background: active ? "rgba(255,255,255,0.05)" : "transparent",
        border: active ? `1px solid ${t.color.border}` : "1px solid transparent",
        fontSize: 12.5,
        fontWeight: active ? 700 : 600,
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{icon(iconName, active)}</span>
      <span>{label}</span>
    </Link>
  );
}

export default function ControlSidebarV2({ isPlatformAdmin }: { isPlatformAdmin: boolean }) {
  const pathname = usePathname();
  const primary = [
    { href: "/shops", label: "Shops", iconName: "shops" },
    { href: "/people", label: "People", iconName: "people" },
    { href: "/devices", label: "Devices", iconName: "devices" },
    { href: "/apps", label: "Apps", iconName: "apps" },
    { href: "/billing-access", label: "Billing & Access", iconName: "billing" },
    { href: "/updates", label: "Updates", iconName: "updates" },
    { href: "/audit", label: "Audit", iconName: "audit" },
  ];
  const secondary = isPlatformAdmin
    ? [
        { href: "/status", label: "Platform Status", iconName: "status" },
        { href: "/settings", label: "Settings", iconName: "settings" },
      ]
    : [{ href: "/settings", label: "Settings", iconName: "settings" }];

  return (
    <div
      style={{
        height: "100vh",
        position: "sticky",
        top: 0,
        display: "grid",
        gridTemplateRows: "auto 1fr auto",
        gap: 18,
        padding: "18px 12px 14px",
        borderRight: `1px solid ${t.color.railBorder}`,
        background: t.color.rail,
      }}
    >
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "grid", gap: 3, padding: "0 6px" }}>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.3, color: t.color.text }}>RunBook Control</div>
          <div style={{ fontSize: 11.5, color: t.color.textQuiet }}>{isPlatformAdmin ? "Platform command center" : "Admin workspace"}</div>
        </div>
        <div style={{ display: "grid", gap: 4 }}>
          {primary.map((item) => <NavItem key={item.href} {...item} pathname={pathname} />)}
        </div>
      </div>

      <div />

      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ padding: "0 6px", color: t.color.textQuiet, ...t.type.label }}>Workspace</div>
        <div style={{ display: "grid", gap: 4 }}>
          {secondary.map((item) => <NavItem key={item.href} {...item} pathname={pathname} />)}
        </div>
      </div>
    </div>
  );
}
