"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import React from "react";
import { controlTheme as t } from "@/components/control/controlTheme";
import ControlStatusChip, { type ControlStatusTone } from "@/components/control/ControlStatusChip";

type NavItem = {
  label: string;
  href: string;
  matchPath: string;
  matchQuery?: { key: string; value: string };
};

function isActive(pathname: string, params: ReturnType<typeof useSearchParams>, item: NavItem) {
  if (!pathname.startsWith(item.matchPath)) return false;
  if (!item.matchQuery) return true;
  return (params.get(item.matchQuery.key) ?? "").trim().toLowerCase() === item.matchQuery.value.toLowerCase();
}

const navItems: NavItem[] = [
  { label: "Command Center", href: "/dashboard", matchPath: "/dashboard" },
  { label: "Shops", href: "/shops", matchPath: "/shops" },
  { label: "Devices", href: "/devices", matchPath: "/devices" },
  { label: "Workstations", href: "/apps?app=workstation", matchPath: "/apps", matchQuery: { key: "app", value: "workstation" } },
  { label: "People", href: "/people", matchPath: "/people" },
  { label: "Mobile Access", href: "/apps?app=mobile", matchPath: "/apps", matchQuery: { key: "app", value: "mobile" } },
  { label: "Timeclock Review", href: "/audit?action=timeclock", matchPath: "/audit" },
  { label: "Billing & Plans", href: "/billing-access", matchPath: "/billing-access" },
  { label: "Support", href: "/support", matchPath: "/support" },
  { label: "Updates", href: "/updates", matchPath: "/updates" },
  { label: "Audit Log", href: "/audit", matchPath: "/audit" },
  { label: "Settings / Policies", href: "/settings", matchPath: "/settings" },
];

export default function ControlSidebar({
  email,
  roleLabel,
  statuses,
}: {
  email: string;
  roleLabel: string;
  statuses: Array<{ key: string; label: string; tone: ControlStatusTone }>;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <aside
      style={{
        display: "grid",
        gridTemplateRows: "auto auto minmax(0, 1fr) auto",
        gap: 18,
        height: "100dvh",
        padding: 16,
        borderRight: `1px solid ${t.color.softBorder}`,
        background: `linear-gradient(180deg, rgba(11, 16, 24, 0.98), rgba(7, 10, 15, 0.98))`,
        position: "sticky",
        top: 0,
        overflow: "hidden",
      }}
    >
      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ color: t.color.text, fontSize: 31, fontWeight: 800, letterSpacing: -1.2 }}>
          RunBook <span style={{ color: "#A78BFA" }}>Control</span>
        </div>
        <div style={{ color: t.color.textMuted, fontSize: 13 }}>Remote cloud authority for shops, devices, access, and billing.</div>
      </div>

      <div
        style={{
          display: "grid",
          gap: 12,
          padding: 14,
          borderRadius: t.radius.lg,
          border: `1px solid ${t.color.softBorder}`,
          background: "linear-gradient(180deg, rgba(16, 23, 34, 0.98), rgba(11, 16, 24, 0.98))",
        }}
      >
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ color: t.color.textSecondary, fontSize: 12, fontWeight: 800, letterSpacing: 0.3 }}>Cloud Authority</div>
          <div style={{ color: t.color.textMuted, fontSize: 12.5 }}>Authenticated admin shell. Server authority stays server-side.</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {statuses.map((status) => (
            <ControlStatusChip key={status.key} label={status.label} tone={status.tone} />
          ))}
        </div>
      </div>

      <nav style={{ overflowY: "auto", paddingRight: 4 }}>
        <div style={{ display: "grid", gap: 6 }}>
          {navItems.map((item) => {
            const querySpecificSiblingActive =
              !item.matchQuery &&
              navItems.some((candidate) => candidate.matchPath === item.matchPath && candidate.matchQuery && isActive(pathname, searchParams, candidate));
            const active = !querySpecificSiblingActive && isActive(pathname, searchParams, item);
            return (
              <Link
                key={item.label}
                href={item.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  minHeight: 44,
                  padding: "0 14px",
                  borderRadius: 12,
                  border: `1px solid ${active ? "rgba(124, 58, 237, 0.34)" : "transparent"}`,
                  color: active ? t.color.text : t.color.textSecondary,
                  background: active ? "linear-gradient(90deg, rgba(124, 58, 237, 0.22), rgba(37, 99, 235, 0.10))" : "transparent",
                  textDecoration: "none",
                  fontSize: 14,
                  fontWeight: active ? 700 : 600,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: active ? "#A78BFA" : "rgba(148, 163, 184, 0.35)",
                    boxShadow: active ? "0 0 18px rgba(124, 58, 237, 0.48)" : "none",
                  }}
                />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <div
        style={{
          display: "grid",
          gap: 4,
          padding: 14,
          borderRadius: t.radius.lg,
          border: `1px solid ${t.color.softBorder}`,
          background: "rgba(18, 27, 40, 0.72)",
        }}
      >
        <div style={{ color: t.color.text, fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis" }}>{email || "Signed-in user"}</div>
        <div style={{ color: t.color.textMuted, fontSize: 12 }}>{roleLabel}</div>
      </div>
    </aside>
  );
}
