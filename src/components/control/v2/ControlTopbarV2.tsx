import Link from "next/link";
import React from "react";
import { controlV2Theme as t } from "@/components/control/v2/controlV2Theme";
import ControlBadgeV2, { toneFromStatusV2 } from "@/components/control/v2/ControlBadgeV2";
import SignOutButton from "@/components/SignOutButton";
import HeaderSearch from "@/components/control/HeaderSearch";

export default function ControlTopbarV2({
  email,
  roleLabel,
  statuses,
}: {
  email: string;
  roleLabel: string;
  statuses: Array<{ key: string; label: string; health: string }>;
}) {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        alignItems: "center",
        minHeight: t.spacing.topbarHeight,
        padding: "10px 20px",
        borderBottom: `1px solid ${t.color.topbarBorder}`,
        background: t.color.topbar,
      }}
    >
      <div style={{ minWidth: 280, maxWidth: 420, flex: "1 1 340px" }}>
        <HeaderSearch />
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
        {statuses.map((status) => (
          <ControlBadgeV2 key={status.key} label={status.label} tone={toneFromStatusV2(status.health)} />
        ))}
        <Link href="/status" style={{ fontSize: 12, color: t.color.textMuted, textDecoration: "none", padding: "0 2px" }}>
          Status
        </Link>
        <div style={{ display: "grid", gap: 1, textAlign: "right", padding: "0 4px" }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: t.color.text }}>{email || "Signed in"}</span>
          <span style={{ fontSize: 11, color: t.color.textQuiet }}>{roleLabel}</span>
        </div>
        <SignOutButton />
      </div>
    </header>
  );
}
