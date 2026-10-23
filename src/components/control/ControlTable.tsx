import React from "react";
import { controlTheme as t } from "@/components/control/controlTheme";

export function ControlTableWrap({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      role="region"
      aria-label="Scrollable data table"
      tabIndex={0}
      style={{
        overflowX: "auto",
        borderRadius: t.radius.md,
        border: `1.25px solid ${t.color.border}`,
        background: t.color.surface,
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
    <table className="control-table" style={{ width: "100%", minWidth, borderCollapse: "collapse" }}>
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
        padding: "11px 14px",
        borderBottom: `1px solid ${t.color.divider}`,
        color: t.color.textSecondary,
        fontSize: 16,
        fontWeight: 600,
        textAlign: align,
        background: t.color.elevated,
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
        padding: "14px",
        borderBottom: `1px solid ${t.color.divider}`,
        color: t.color.textSecondary,
        fontSize: 16,
        lineHeight: 1.45,
        textAlign: align,
        verticalAlign: "middle",
      }}
    >
      {children}
    </td>
  );
}
