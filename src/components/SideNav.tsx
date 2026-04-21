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
    <section className="rbNavGroup">
      <div className="rbNavGroupTitle">{title}</div>
      <div className="rbNavGroupItems">{children}</div>
    </section>
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
    <Link href={href} className={selected ? "rbNavItem rbNavItemSelected" : "rbNavItem"}>
      <span className="rbNavItemGlow" />
      <span className="rbNavIconWrap">
        <span className="rbNavIcon">
          <Icon name={icon} size={17} tone={selected ? "accent" : "neutral"} />
        </span>
      </span>
      <span className="rbNavCopy">
        <span className="rbNavLabel">{label}</span>
        {detail ? <span className="rbNavDetail">{detail}</span> : null}
      </span>
    </Link>
  );
}

function ModePill({ children }: { children: React.ReactNode }) {
  return <span className="rbModePill">{children}</span>;
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
      <>
        <nav className="rbNavShell">
          <div className="rbNavIntro">
            <ModePill>Shop Command Center</ModePill>
            <div className="rbNavHeading">{shopName ?? "Shop"}</div>
            <div className="rbNavSummary">
              Manage people, devices, billing, and access with a cleaner view of
              the shop workspace.
            </div>
          </div>

          <NavGroup title="Shop">
            <NavItem
              href={`/shops/${shopId}`}
              label="Overview"
              detail="Status, setup, and attention items."
              icon="shop"
              selected={isSelected(pathname, `/shops/${shopId}`)}
            />
            <NavItem
              href={`/shops/${shopId}/billing`}
              label="Billing & Access"
              detail="Plan, restrictions, and app impact."
              icon="billing"
              selected={isSelected(pathname, `/shops/${shopId}/billing`)}
            />
            <NavItem
              href={`/shops/${shopId}/devices`}
              label="Devices"
              detail="Desktop and workstation health."
              icon="devices"
              selected={isSelected(pathname, `/shops/${shopId}/devices`)}
            />
            <NavItem
              href={`/shops/${shopId}/policy`}
              label="Updates"
              detail="Rollout rules and version gates."
              icon="updates"
              selected={isSelected(pathname, `/shops/${shopId}/policy`)}
            />
            <NavItem
              href={`/shops/${shopId}/audit`}
              label="Activity"
              detail="Recent shop events and actions."
              icon="audit"
              selected={isSelected(pathname, `/shops/${shopId}/audit`)}
            />
          </NavGroup>

          <NavGroup title="Platform">
            <NavItem
              href="/dashboard"
              label="Dashboard"
              detail="Return to the command center."
              icon="spark"
              selected={isSelected(pathname, "/dashboard")}
            />
            <NavItem
              href="/shops"
              label="Shop List"
              detail="Switch shops or review ownership."
              icon="shop"
              selected={isSelected(pathname, "/shops")}
            />
          </NavGroup>
        </nav>
        <style jsx>{styles}</style>
      </>
    );
  }

  return (
    <>
      <nav className="rbNavShell">
        <div className="rbNavIntro">
          <ModePill>{isPlatformAdmin ? "Platform Command Center" : "Admin Workspace"}</ModePill>
          <div className="rbNavHeading">RunBook Control</div>
          <div className="rbNavSummary">
            Monitor health, manage people, review devices, and fix access with a
            calmer command surface.
          </div>
        </div>

        <NavGroup title="Command Center">
          <NavItem
            href="/dashboard"
            label="Dashboard"
            detail="Alerts, health, and next actions."
            icon="spark"
            selected={isSelected(pathname, "/dashboard")}
          />
          <NavItem
            href="/shops"
            label="Shop"
            detail="Profile, settings, and access summary."
            icon="shop"
            selected={isSelected(pathname, "/shops")}
          />
          <NavItem
            href="/people"
            label="People"
            detail="Employees, provisioning, and readiness."
            icon="people"
            selected={isSelected(pathname, "/people")}
          />
          <NavItem
            href="/devices"
            label="Devices"
            detail="Desktops, workstations, and health."
            icon="devices"
            selected={isSelected(pathname, "/devices")}
          />
          <NavItem
            href="/apps"
            label="Apps"
            detail="Desktop, Workstation, Mobile, and Control."
            icon="apps"
            selected={isSelected(pathname, "/apps")}
          />
          <NavItem
            href="/billing-access"
            label="Billing & Access"
            detail="Plan state and access outcomes."
            icon="billing"
            selected={isSelected(pathname, "/billing-access")}
          />
          <NavItem
            href="/updates"
            label="Updates"
            detail="Rollout policy and readiness."
            icon="updates"
            selected={isSelected(pathname, "/updates")}
          />
          <NavItem
            href="/audit"
            label="Audit / Activity"
            detail="Important changes and recent events."
            icon="audit"
            selected={isSelected(pathname, "/audit")}
          />
        </NavGroup>

        {isPlatformAdmin ? (
          <NavGroup title="Platform Admin">
            <NavItem
              href="/status"
              label="Platform Status"
              detail="Supabase, Stripe, and diagnostics."
              icon="activity"
              selected={isSelected(pathname, "/status")}
            />
            <NavItem
              href="/settings"
              label="Settings"
              detail="Security, preferences, and MFA."
              icon="settings"
              selected={isSelected(pathname, "/settings")}
            />
            <NavItem
              href="/support"
              label="Support"
              detail="Bundle guidance and troubleshooting."
              icon="support"
              selected={isSelected(pathname, "/support")}
            />
          </NavGroup>
        ) : (
          <NavGroup title="Workspace">
            <NavItem
              href="/settings"
              label="Settings"
              detail="Security and admin preferences."
              icon="settings"
              selected={isSelected(pathname, "/settings")}
            />
          </NavGroup>
        )}
      </nav>
      <style jsx>{styles}</style>
    </>
  );
}

const styles = `
  .rbNavShell {
    display: grid;
    gap: 18px;
  }

  .rbNavIntro {
    display: grid;
    gap: 10px;
    padding: 2px 4px 6px;
  }

  .rbModePill {
    display: inline-flex;
    width: fit-content;
    align-items: center;
    padding: 7px 11px;
    border-radius: ${theme.radius.pill}px;
    border: 1px solid rgba(146, 163, 255, 0.24);
    background: linear-gradient(180deg, rgba(92, 108, 255, 0.16), rgba(75, 133, 255, 0.11));
    color: #dce3ff;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 0.82px;
    text-transform: uppercase;
  }

  .rbNavHeading {
    font-size: 22px;
    font-weight: 800;
    line-height: 1.06;
    letter-spacing: -0.4px;
    color: ${theme.text.primary};
  }

  .rbNavSummary {
    color: ${theme.text.muted};
    font-size: 12.5px;
    line-height: 1.58;
    max-width: 28ch;
  }

  .rbNavGroup {
    display: grid;
    gap: 10px;
  }

  .rbNavGroupTitle {
    padding-left: 4px;
    color: ${theme.text.quiet};
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 1px;
    text-transform: uppercase;
  }

  .rbNavGroupItems {
    display: grid;
    gap: 8px;
    padding: 10px;
    border-radius: ${theme.radius.lg}px;
    border: ${theme.border.nav};
    background: ${theme.bg.navSection};
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.03);
  }

  .rbNavItem {
    position: relative;
    display: grid;
    grid-template-columns: 48px minmax(0, 1fr);
    gap: 12px;
    align-items: start;
    padding: 12px 12px 12px 10px;
    border-radius: 16px;
    border: 1px solid rgba(255,255,255,0.05);
    background: ${theme.bg.navIdle};
    color: ${theme.text.primary};
    text-decoration: none;
    transition: transform 150ms ease, border-color 170ms ease, background 170ms ease, box-shadow 180ms ease;
    overflow: hidden;
  }

  .rbNavItem:hover {
    transform: translateX(1px);
    border-color: rgba(122,157,214,0.16);
    background: linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.03));
    box-shadow: 0 16px 28px rgba(0,0,0,0.18);
  }

  .rbNavItemSelected {
    border-color: rgba(137,160,255,0.28);
    background: ${theme.bg.navActive};
    box-shadow: 0 18px 36px rgba(10,18,32,0.30);
  }

  .rbNavItemGlow {
    position: absolute;
    inset: 0 auto 0 0;
    width: 3px;
    background: transparent;
  }

  .rbNavItemSelected .rbNavItemGlow {
    background: linear-gradient(180deg, #7ea8ff, #6d82ff 50%, #9a75ff);
    box-shadow: 0 0 22px rgba(110,130,255,0.46);
  }

  .rbNavIconWrap {
    display: flex;
    justify-content: center;
    padding-top: 1px;
  }

  .rbNavIcon {
    width: 38px;
    height: 38px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 14px;
    border: 1px solid rgba(255,255,255,0.08);
    background: linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.03));
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
  }

  .rbNavItemSelected .rbNavIcon {
    border-color: rgba(145,165,255,0.24);
    background: linear-gradient(180deg, rgba(111,128,255,0.15), rgba(73,160,255,0.08));
    box-shadow: 0 10px 26px rgba(23,39,110,0.20), inset 0 1px 0 rgba(255,255,255,0.06);
  }

  .rbNavCopy {
    display: grid;
    gap: 4px;
    min-width: 0;
  }

  .rbNavLabel {
    font-size: 14px;
    font-weight: 800;
    line-height: 1.15;
    letter-spacing: -0.14px;
    color: ${theme.text.primary};
  }

  .rbNavDetail {
    font-size: 11.5px;
    line-height: 1.45;
    color: ${theme.text.quiet};
  }

  .rbNavItemSelected .rbNavDetail {
    color: rgba(234, 240, 255, 0.78);
  }
`;
