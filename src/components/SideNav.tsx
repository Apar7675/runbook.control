"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import { Icon } from "@/components/control/ui";

type Mode = "platform" | "shop";

function NavGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rb-navSection">
      <div className="rb-navSectionLabel">{title}</div>
      <div className="rb-navList">{children}</div>
    </div>
  );
}

function NavItem({
  href,
  label,
  selected,
  icon,
}: {
  href: string;
  label: string;
  selected?: boolean;
  icon: React.ComponentProps<typeof Icon>["name"];
}) {
  return (
    <Link href={href} className={selected ? "rb-navItem rb-navItem--selected" : "rb-navItem"}>
      <span className="rb-navRail" />
      <span className="rb-navIcon">
        <Icon name={icon} size={18} tone={selected ? "accent" : "neutral"} />
      </span>
      <span className="rb-navLabel">{label}</span>
    </Link>
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

  const intro =
    mode === "shop"
      ? {
          pill: "Shop",
          title: shopName ?? "Shop",
          copy: "Billing, devices, updates, and activity stay grouped under one workspace instead of fragmenting into separate styles.",
        }
      : {
          pill: isPlatformAdmin ? "Platform" : "Workspace",
          title: isPlatformAdmin ? "Command Center" : "Admin Workspace",
          copy: "Run the full control plane with the same premium shell language used across the product family.",
        };

  return (
    <nav className="rb-nav">
      <div className="rb-sidebarIntro">
        <span className="rb-rolePill">{intro.pill}</span>
        <div className="rb-sidebarIntroTitle">{intro.title}</div>
        <div className="rb-sidebarIntroCopy">{intro.copy}</div>
      </div>

      {mode === "shop" && shopId ? (
        <>
          <NavGroup title="Shop">
            <NavItem href={`/shops/${shopId}`} label="Overview" icon="shop" selected={isSelected(pathname, `/shops/${shopId}`)} />
            <NavItem href={`/shops/${shopId}/billing`} label="Billing & Access" icon="billing" selected={isSelected(pathname, `/shops/${shopId}/billing`)} />
            <NavItem href={`/shops/${shopId}/devices`} label="Devices" icon="devices" selected={isSelected(pathname, `/shops/${shopId}/devices`)} />
            <NavItem href={`/shops/${shopId}/policy`} label="Updates" icon="updates" selected={isSelected(pathname, `/shops/${shopId}/policy`)} />
            <NavItem href={`/shops/${shopId}/audit`} label="Activity" icon="audit" selected={isSelected(pathname, `/shops/${shopId}/audit`)} />
          </NavGroup>

          <NavGroup title="Switch">
            <NavItem href="/dashboard" label="Dashboard" icon="spark" selected={isSelected(pathname, "/dashboard")} />
            <NavItem href="/shops" label="All Shops" icon="shop" selected={isSelected(pathname, "/shops")} />
          </NavGroup>
        </>
      ) : (
        <>
          <NavGroup title="Control">
            <NavItem href="/dashboard" label="Dashboard" icon="spark" selected={isSelected(pathname, "/dashboard")} />
            <NavItem href="/shops" label="Shops" icon="shop" selected={isSelected(pathname, "/shops")} />
            <NavItem href="/people" label="People" icon="people" selected={isSelected(pathname, "/people")} />
            <NavItem href="/devices" label="Devices" icon="devices" selected={isSelected(pathname, "/devices")} />
            <NavItem href="/apps" label="Apps" icon="apps" selected={isSelected(pathname, "/apps")} />
            <NavItem href="/billing-access" label="Billing & Access" icon="billing" selected={isSelected(pathname, "/billing-access")} />
            <NavItem href="/updates" label="Updates" icon="updates" selected={isSelected(pathname, "/updates")} />
            <NavItem href="/audit" label="Activity" icon="audit" selected={isSelected(pathname, "/audit")} />
          </NavGroup>

          <NavGroup title={isPlatformAdmin ? "Admin" : "Workspace"}>
            {isPlatformAdmin ? <NavItem href="/status" label="Platform Status" icon="activity" selected={isSelected(pathname, "/status")} /> : null}
            <NavItem href="/settings" label="Settings" icon="settings" selected={isSelected(pathname, "/settings")} />
            {isPlatformAdmin ? <NavItem href="/support" label="Support" icon="support" selected={isSelected(pathname, "/support")} /> : null}
          </NavGroup>
        </>
      )}
    </nav>
  );
}
