"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import { Icon } from "@/components/control/ui";
import { theme } from "@/lib/ui/theme";

type Mode = "platform" | "shop";

function NavGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div
        style={{
          color: theme.text.quiet,
          fontSize: 9.5,
          fontWeight: 900,
          letterSpacing: 1.1,
          textTransform: "uppercase",
          paddingLeft: 2,
        }}
      >
        {title}
      </div>
      <div
        style={{
          display: "grid",
          gap: 5,
          padding: 6,
          borderRadius: 14,
          border: "1px solid rgba(255,255,255,0.05)",
          background: "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function NavItem({
  href,
  label,
  detail,
  selected,
  icon,
}: {
  href: string;
  label: string;
  detail?: string;
  selected?: boolean;
  icon: React.ComponentProps<typeof Icon>["name"];
}) {
  return (
    <>
      <Link
        href={href}
        className={selected ? "rbNavItem rbNavItemSelected" : "rbNavItem"}
      >
        <span className="rbNavIcon">
          <Icon name={icon} size={15} tone={selected ? "accent" : "neutral"} />
        </span>
        <span style={{ display: "grid", gap: 2 }}>
          <span style={{ fontWeight: 900, fontSize: 13 }}>{label}</span>
          {detail ? <span className="rbNavDetail">{detail}</span> : null}
        </span>
      </Link>
      <style jsx>{`
        .rbNavItem {
          position: relative;
          display: grid;
          grid-template-columns: 28px minmax(0, 1fr);
          align-items: start;
          gap: 9px;
          padding: 9px 10px 9px 12px;
          border-radius: 12px;
          text-decoration: none;
          color: ${theme.text.primary};
          border: 1px solid rgba(255, 255, 255, 0.05);
          background: rgba(255, 255, 255, 0.02);
          transition: transform 140ms ease, border-color 160ms ease, background 160ms ease, box-shadow 170ms ease;
        }
        .rbNavItem::before {
          content: "";
          position: absolute;
          left: 0;
          top: 9px;
          bottom: 9px;
          width: 2px;
          border-radius: 999px;
          background: transparent;
        }
        .rbNavItem:hover {
          transform: translateX(1px);
          border-color: rgba(122, 157, 214, 0.16);
          background: rgba(255, 255, 255, 0.04);
          box-shadow: 0 12px 28px rgba(0, 0, 0, 0.18);
        }
        .rbNavItemSelected {
          color: #f2f5ff;
          border-color: rgba(122, 157, 214, 0.26);
          background: linear-gradient(135deg, rgba(126, 171, 217, 0.16), rgba(58, 84, 123, 0.12));
          box-shadow: 0 16px 34px rgba(10, 18, 32, 0.26);
        }
        .rbNavItemSelected::before {
          background: linear-gradient(180deg, #7ea8ff, #6d82ff 50%, #e2ae58);
        }
        .rbNavItemSelected:hover {
          transform: translateX(1px);
          box-shadow: 0 16px 32px rgba(10, 18, 32, 0.30);
        }
        .rbNavIcon {
          width: 24px;
          height: 24px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, 0.06);
          background: rgba(255, 255, 255, 0.03);
        }
        .rbNavItemSelected .rbNavIcon {
          border-color: rgba(136, 157, 255, 0.20);
          background: rgba(111, 128, 255, 0.10);
          box-shadow: 0 0 0 1px rgba(95, 128, 255, 0.05), 0 8px 20px rgba(23, 39, 110, 0.16);
        }
        .rbNavDetail {
          color: ${theme.text.secondary};
          font-size: 10px;
          line-height: 1.3;
        }
        .rbNavItemSelected .rbNavDetail {
          color: rgba(242, 245, 255, 0.76);
        }
      `}</style>
    </>
  );
}

function ModePill({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        width: "fit-content",
        alignItems: "center",
        padding: "6px 10px",
        borderRadius: 999,
        border: "1px solid rgba(146, 163, 255, 0.22)",
        background: "rgba(92, 108, 255, 0.14)",
        color: "#d6ddff",
        fontWeight: 900,
        fontSize: 10,
        letterSpacing: 0.82,
        textTransform: "uppercase",
      }}
    >
      {children}
    </span>
  );
}

function isSelected(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  if (href === "/shops") return pathname === "/shops";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function SideNav(props: {
  isPlatformAdmin: boolean;
  mode?: Mode;
  shopId?: string | null;
  shopName?: string | null;
}) {
  const { isPlatformAdmin, mode = "platform", shopId, shopName } = props;
  const pathname = usePathname();

  if (mode === "shop" && shopId) {
    return (
      <nav style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gap: 6, paddingBottom: 2 }}>
        <ModePill>Shop Command Center</ModePill>
        <div style={{ fontWeight: 900, fontSize: 16, letterSpacing: -0.24 }}>{shopName ?? "Shop"}</div>
        <div style={{ color: theme.text.muted, fontSize: 10.5, lineHeight: 1.34 }}>
          Manage people, devices, billing, and access without digging through platform internals.
        </div>
      </div>

        <NavGroup title="Shop">
          <NavItem href={`/shops/${shopId}`} label="Overview" detail="Status, setup, and attention items." icon="shop" selected={isSelected(pathname, `/shops/${shopId}`)} />
          <NavItem href={`/shops/${shopId}/billing`} label="Billing & Access" detail="Plan, restrictions, and app impact." icon="billing" selected={isSelected(pathname, `/shops/${shopId}/billing`)} />
          <NavItem href={`/shops/${shopId}/devices`} label="Devices" detail="Desktop and workstation health." icon="devices" selected={isSelected(pathname, `/shops/${shopId}/devices`)} />
          <NavItem href={`/shops/${shopId}/policy`} label="Updates" detail="Rollout rules and version gates." icon="updates" selected={isSelected(pathname, `/shops/${shopId}/policy`)} />
          <NavItem href={`/shops/${shopId}/audit`} label="Activity" detail="Recent shop events and actions." icon="audit" selected={isSelected(pathname, `/shops/${shopId}/audit`)} />
        </NavGroup>

        <NavGroup title="Platform">
          <NavItem href="/dashboard" label="Dashboard" detail="Return to the command center." icon="spark" selected={isSelected(pathname, "/dashboard")} />
          <NavItem href="/shops" label="Shop List" detail="Switch shops or review ownership." icon="shop" selected={isSelected(pathname, "/shops")} />
        </NavGroup>
      </nav>
    );
  }

  return (
    <nav style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gap: 6, paddingBottom: 2 }}>
        <ModePill>{isPlatformAdmin ? "Platform Command Center" : "Admin Workspace"}</ModePill>
        <div style={{ fontWeight: 900, fontSize: 16, letterSpacing: -0.24 }}>RunBook Control</div>
        <div style={{ color: theme.text.muted, fontSize: 10.5, lineHeight: 1.34 }}>
          Monitor health, manage people, review devices, and fix access quickly.
        </div>
      </div>

      <NavGroup title="Command Center">
        <NavItem href="/dashboard" label="Dashboard" detail="Alerts, health, and next actions." icon="spark" selected={isSelected(pathname, "/dashboard")} />
        <NavItem href="/shops" label="Shop" detail="Profile, settings, and access summary." icon="shop" selected={isSelected(pathname, "/shops")} />
        <NavItem href="/people" label="People" detail="Employees, provisioning, and readiness." icon="people" selected={isSelected(pathname, "/people")} />
        <NavItem href="/devices" label="Devices" detail="Desktops, workstations, and health." icon="devices" selected={isSelected(pathname, "/devices")} />
        <NavItem href="/apps" label="Apps" detail="Desktop, Workstation, Mobile, and Control." icon="apps" selected={isSelected(pathname, "/apps")} />
        <NavItem href="/billing-access" label="Billing & Access" detail="Plan state and access outcomes." icon="billing" selected={isSelected(pathname, "/billing-access")} />
        <NavItem href="/updates" label="Updates" detail="Rollout policy and readiness." icon="updates" selected={isSelected(pathname, "/updates")} />
        <NavItem href="/audit" label="Audit / Activity" detail="Important changes and recent events." icon="audit" selected={isSelected(pathname, "/audit")} />
      </NavGroup>

      {isPlatformAdmin ? (
        <NavGroup title="Platform Admin">
          <NavItem href="/status" label="Platform Status" detail="Supabase, Stripe, and diagnostics." icon="activity" selected={isSelected(pathname, "/status")} />
          <NavItem href="/settings" label="Settings" detail="Security, preferences, and MFA." icon="settings" selected={isSelected(pathname, "/settings")} />
          <NavItem href="/support" label="Support" detail="Bundle guidance and troubleshooting." icon="support" selected={isSelected(pathname, "/support")} />
        </NavGroup>
      ) : (
        <NavGroup title="Workspace">
          <NavItem href="/settings" label="Settings" detail="Security and admin preferences." icon="settings" selected={isSelected(pathname, "/settings")} />
        </NavGroup>
      )}
    </nav>
  );
}
