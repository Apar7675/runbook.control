import React from "react";
import { controlTheme as t } from "@/components/control/controlTheme";

export function ControlTableWrap({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        overflowX: "auto",
        borderRadius: t.radius.md,
        border: `1px solid ${t.color.softBorder}`,
        background: "rgba(7, 10, 15, 0.30)",
      }}
    >
      {children}
    </div>
  );
}

export function ControlTable({
  children,
  minWidth,
}: {
  children: React.ReactNode;
  minWidth?: number;
}) {
  return (
    <table style={{ width: "100%", minWidth, borderCollapse: "collapse" }}>
      {children}
    </table>
  );
}

export function ControlTableHeadCell({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right" | "center";
}) {
  return (
    <th
      style={{
        padding: "12px 14px",
        borderBottom: `1px solid ${t.color.softBorder}`,
        color: t.color.textMuted,
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: 0.72,
        textTransform: "uppercase",
        textAlign: align,
        background: "rgba(16, 23, 34, 0.72)",
      }}
    >
      {children}
    </th>
  );
}

export function ControlTableCell({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right" | "center";
}) {
  return (
    <td
      style={{
        padding: "12px 14px",
        borderBottom: `1px solid rgba(148, 163, 184, 0.10)`,
        color: t.color.textSecondary,
        fontSize: 13,
        textAlign: align,
        verticalAlign: "top",
      }}
    >
      {children}
    </td>
  );
}
