"use client";

import Link from "@/components/control/CompanyLink";
import { usePathname, useSearchParams } from "next/navigation";
import React from "react";
import type { ControlStatusTone } from "@/components/control/ControlStatusChip";

type NavItem = {
  label: string;
  href: string;
  matchPath: string;
  matchQuery?: { key: string; value: string };
  icon?: { file: string; tile: string };
};

function isActive(pathname: string, params: ReturnType<typeof useSearchParams>, item: NavItem) {
  if (!pathname.startsWith(item.matchPath)) return false;
  if (!item.matchQuery) return true;
  return (params.get(item.matchQuery.key) ?? "").trim().toLowerCase() === item.matchQuery.value.toLowerCase();
}

const navItems: NavItem[] = [
  { label: "Command Center", href: "/dashboard", matchPath: "/dashboard", icon: { file: "dashboard.svg", tile: "#2858C8" } },
  { label: "Shops", href: "/shops", matchPath: "/shops", icon: { file: "shops.png", tile: "#EDF3FC" } },
  { label: "Devices", href: "/devices", matchPath: "/devices", icon: { file: "devices.svg", tile: "#2858C8" } },
  { label: "Workstations", href: "/workstations", matchPath: "/workstations", icon: { file: "workstations.svg", tile: "#2858C8" } },
  { label: "People", href: "/people", matchPath: "/people", icon: { file: "people.svg", tile: "#A85835" } },
  { label: "Mobile Access", href: "/mobile-access", matchPath: "/mobile-access", icon: { file: "mobile-access.svg", tile: "#2858C8" } },
  { label: "Timeclock Review", href: "/timeclock-review", matchPath: "/timeclock-review", icon: { file: "timeclock.svg", tile: "#EDF3FC" } },
  { label: "Billing & Plans", href: "/billing-access", matchPath: "/billing-access", icon: { file: "billing-plans.svg", tile: "#2858C8" } },
  { label: "Support", href: "/support", matchPath: "/support", icon: { file: "support.svg", tile: "#52677B" } },
  { label: "Software Updates", href: "/software-updates", matchPath: "/software-updates", icon: { file: "software-updates.svg", tile: "#2858C8" } },
  { label: "Updates", href: "/updates", matchPath: "/updates", icon: { file: "updates.svg", tile: "#2858C8" } },
  { label: "Audit Log", href: "/audit", matchPath: "/audit", icon: { file: "audit.svg", tile: "#2858C8" } },
  { label: "Settings / Policies", href: "/settings", matchPath: "/settings", icon: { file: "settings.svg", tile: "#52677B" } },
];

const statusColors: Record<ControlStatusTone, string> = {
  neutral: "#B8CBE4", info: "#9AD8FF", success: "#78E4C0", warning: "#FFD78B", danger: "#FFADB8",
};

export default function ControlSidebar({ email, roleLabel, statuses }: {
  email: string;
  roleLabel: string;
  statuses: Array<{ key: string; label: string; tone: ControlStatusTone }>;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initial = (email.trim().charAt(0) || "?").toLocaleUpperCase();

  return (
    <aside className="control-sidebar" style={{ display: "grid", gridTemplateRows: "auto minmax(0, 1fr) auto", gap: 10, height: "100dvh", minHeight: 0, boxSizing: "border-box", padding: "12px 14px", borderRight: "1px solid #2A4565", background: "#0B1C35", color: "#F5F8FF", position: "sticky", top: 0, overflow: "hidden" }}>
      <div style={{ display: "grid", gap: 10 }}>
        {/* Approved original logo and source-verified module artwork; see artwork provenance. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="control-brand" src="/artwork/control-sample2/runbook-logo.png" alt="RunBook" width={796} height={229} style={{ display: "block", width: "100%", maxWidth: 180, height: "auto", margin: "0 auto" }} />
      </div>
      <nav className="control-nav" aria-label="Control navigation" style={{ minHeight: 0, overflowY: "auto", overflowX: "hidden", padding: "0 2px 3px", margin: "0 -2px", scrollbarWidth: "thin", scrollbarColor: "#385573 transparent" }}>
        <div className="control-nav-items" style={{ display: "grid", gap: 1 }}>
          {navItems.map((item) => {
            const querySpecificSiblingActive =
              !item.matchQuery &&
              navItems.some((candidate) => candidate.matchPath === item.matchPath && candidate.matchQuery && isActive(pathname, searchParams, candidate));
            const active = !querySpecificSiblingActive && isActive(pathname, searchParams, item);
            return (
              <Link key={item.label} href={item.href} className="control-nav-item" aria-current={active ? "page" : undefined} style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 36, padding: "3px 6px", borderRadius: active ? 8 : 0, border: active ? "1px solid #42BDFF" : "1px solid transparent", borderBottomColor: active ? "#42BDFF" : "#24435F", color: "#F5F8FF", background: active ? "#075FFF" : "transparent", boxShadow: active ? "0 0 0 2px rgba(0, 102, 255, 0.14)" : "none", textDecoration: "none", fontSize: 14, fontWeight: active ? 600 : 400, lineHeight: 1.3 }}>
                <span className="control-module-icon" aria-hidden="true" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, flex: "0 0 28px", borderRadius: 7, background: item.icon?.tile ?? "transparent" }}>
                  {item.icon ? (
                    // Verified original or owner-approved SVG/PNG; preserve the exact artwork.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/artwork/runbook-refined-b/${item.icon.file}`} alt="" width={22} height={22} style={{ objectFit: "contain" }} />
                  ) : null}
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
      <div style={{ display: "grid", gap: 8, paddingTop: 10, borderTop: "1px solid #294866" }}>
        {statuses.length > 0 ? (
          <div aria-label="Connection status" style={{ display: "flex", gap: "5px 9px", flexWrap: "wrap" }}>
            {statuses.map((status) => (
              <span key={status.key} style={{ display: "inline-flex", alignItems: "center", gap: 5, color: statusColors[status.tone], fontSize: 12, lineHeight: 1.4 }}>
                <span aria-hidden="true" style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor", flexShrink: 0 }} />
                {status.label}
              </span>
            ))}
          </div>
        ) : null}
        <div style={{ display: "grid", gridTemplateColumns: "34px minmax(0, 1fr)", gap: 8, alignItems: "center" }}>
          <span aria-hidden="true" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, border: "1px solid #3972A2", borderRadius: "50%", background: "#102840", color: "#EAF3FF", fontSize: 13, fontWeight: 600 }}>{initial}</span>
          <div style={{ display: "grid", gap: 1, minWidth: 0 }}>
            <div title={email || undefined} style={{ color: "#F5F8FF", fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email || "Signed-in user"}</div>
            <div style={{ color: "#A6BFDD", fontSize: 12, overflowWrap: "anywhere" }}>{roleLabel}</div>
          </div>
        </div>
      </div>
      <style>{`
        .control-sidebar, .control-sidebar .control-nav { scroll-padding-block: 6px; }
        .control-sidebar .control-nav-item { scroll-margin-block: 6px; }
        .control-sidebar .control-nav-item:hover { background-color: rgba(102, 153, 204, 0.12) !important; }
        .control-sidebar .control-nav-item[aria-current="page"]:hover { border-color: #8BD7FF !important; }
      `}</style>
    </aside>
  );
}
