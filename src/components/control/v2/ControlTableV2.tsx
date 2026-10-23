import React from "react";
import { controlV2Theme as t } from "@/components/control/v2/controlV2Theme";

export function ControlTableWrapV2({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ border: `1px solid ${t.color.border}`, borderRadius: t.radius.md, overflow: "hidden", background: t.color.surface }}>
      <div style={{ overflowX: "auto" }}>{children}</div>
    </div>
  );
}

export function ControlTableV2({ children, minWidth }: { children: React.ReactNode; minWidth?: number }) {
  return <table style={{ width: "100%", minWidth, borderCollapse: "collapse", fontSize: 12.5 }}>{children}</table>;
}

export function ControlTableHeadCellV2({
  align = "left",
  children,
}: {
  align?: "left" | "right" | "center";
  children: React.ReactNode;
}) {
  return (
    <th
      style={{
        textAlign: align,
        padding: "9px 12px",
        background: t.color.tableHead,
        color: t.color.text,
        fontSize: 12,
        fontWeight: 700,
        borderBottom: `1px solid ${t.color.border}`,
      }}
    >
      {children}
    </th>
  );
}

export function ControlTableCellV2({
  align = "left",
  children,
}: {
  align?: "left" | "right" | "center";
  children: React.ReactNode;
}) {
  return (
    <td
      style={{
        textAlign: align,
        padding: "9px 12px",
        verticalAlign: "top",
        borderTop: `1px solid ${t.color.border}`,
        color: t.color.textMuted,
        lineHeight: 1.45,
      }}
    >
      {children}
    </td>
  );
}
