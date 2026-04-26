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
          <Icon name={icon} size={14} tone={selected ? "accent" : "neutral"} />
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
              href={`/shops/${shopId}/members`}
              label="Users"
              detail="Membership, access, and employee review."
              icon="people"
              selected={isSelected(pathname, `/shops/${shopId}/members`)}
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
          <div className="rbBrandRow">
            <span className="rbBrandIcon">
              <Icon name="shop" size={14} tone="accent" />
            </span>
            <div className="rbBrandCopy">
              <div className="rbNavHeading">RunBook Control</div>
              <div className="rbBrandSub">{isPlatformAdmin ? "Platform command center" : "Admin workspace"}</div>
            </div>
          </div>
          <ModePill>{isPlatformAdmin ? "Platform" : "Shop Admin"}</ModePill>
        </div>

        <NavGroup title="Command Center">
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
    gap: 14px;
    width: 100%;
  }

  .rbNavIntro {
    display: grid;
    gap: 10px;
    padding: 0 0 8px;
    borderBottom: 1px solid rgba(255,255,255,0.06);
  }

  .rbBrandRow {
    display: grid;
    grid-template-columns: 28px minmax(0, 1fr);
    gap: 10px;
    align-items: center;
  }

  .rbBrandIcon {
    width: 28px;
    height: 28px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    border: 1px solid rgba(145,165,255,0.18);
    background: rgba(111,128,255,0.10);
  }

  .rbBrandCopy {
    display: grid;
    gap: 2px;
    min-width: 0;
  }

  .rbModePill {
    display: inline-flex;
    width: fit-content;
    align-items: center;
    padding: 5px 9px;
    border-radius: ${theme.radius.pill}px;
    border: 1px solid rgba(146, 163, 255, 0.24);
    background: linear-gradient(180deg, rgba(92, 108, 255, 0.16), rgba(75, 133, 255, 0.11));
    color: #dce3ff;
    font-size: 9.5px;
    font-weight: 900;
    letter-spacing: 0.7px;
    text-transform: uppercase;
  }

  .rbNavHeading {
    font-size: 16px;
    font-weight: 800;
    line-height: 1.04;
    letter-spacing: -0.26px;
    color: ${theme.text.primary};
  }

  .rbBrandSub {
    color: ${theme.text.quiet};
    font-size: 10.5px;
    line-height: 1.25;
  }

  .rbNavSummary {
    color: ${theme.text.muted};
    font-size: 11.5px;
    line-height: 1.42;
    max-width: 26ch;
  }

  .rbNavGroup {
    display: grid;
    gap: 7px;
  }

  .rbNavGroupTitle {
    padding-left: 0;
    color: ${theme.text.quiet};
    font-size: 9.5px;
    font-weight: 900;
    letter-spacing: 0.82px;
    text-transform: uppercase;
  }

  .rbNavGroupItems {
    display: grid;
    gap: 4px;
    padding: 0;
    border-radius: 0;
    border: 0;
    background: transparent;
    box-shadow: none;
  }

  .rbNavItem {
    position: relative;
    display: grid;
    grid-template-columns: 34px minmax(0, 1fr);
    gap: 9px;
    align-items: center;
    padding: 8px 8px 8px 6px;
    border-radius: 10px;
    border: 1px solid transparent;
    background: transparent;
    color: ${theme.text.primary};
    text-decoration: none;
    transition: border-color 150ms ease, background 150ms ease;
    overflow: hidden;
  }

  .rbNavItem:hover {
    border-color: rgba(122,157,214,0.12);
    background: rgba(255,255,255,0.03);
  }

  .rbNavItemSelected {
    border-color: rgba(137,160,255,0.18);
    background: rgba(102,128,255,0.10);
    box-shadow: none;
  }

  .rbNavItemGlow {
    position: absolute;
    inset: 0 auto 0 0;
    width: 2px;
    background: transparent;
  }

  .rbNavItemSelected .rbNavItemGlow {
    background: linear-gradient(180deg, #7ea8ff, #6d82ff 50%, #9a75ff);
  }

  .rbNavIconWrap {
    display: flex;
    justify-content: center;
  }

  .rbNavIcon {
    width: 24px;
    height: 24px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    border: 1px solid rgba(255,255,255,0.04);
    background: rgba(255,255,255,0.02);
  }

  .rbNavItemSelected .rbNavIcon {
    border-color: rgba(145,165,255,0.14);
    background: rgba(111,128,255,0.10);
    box-shadow: none;
  }

  .rbNavCopy {
    display: grid;
    gap: 1px;
    min-width: 0;
  }

  .rbNavLabel {
    font-size: 12.5px;
    font-weight: 800;
    line-height: 1.15;
    letter-spacing: -0.08px;
    color: ${theme.text.primary};
  }

  .rbNavDetail {
    font-size: 10.5px;
    line-height: 1.3;
    color: ${theme.text.quiet};
  }

  .rbNavItemSelected .rbNavDetail {
    color: rgba(234, 240, 255, 0.78);
  }
`;
