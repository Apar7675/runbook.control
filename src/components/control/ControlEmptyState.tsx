import React from "react";
import { controlTheme as t } from "@/components/control/controlTheme";

export default function ControlEmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        gap: 10,
        justifyItems: "start",
        padding: "18px 0",
      }}
    >
      <div style={{ width: 42, height: 42, borderRadius: 14, border: `1px solid ${t.color.softBorder}`, background: "rgba(37, 99, 235, 0.10)" }} />
      <div style={{ display: "grid", gap: 4 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: t.color.text }}>{title}</div>
        <div style={{ fontSize: 13, color: t.color.textMuted, maxWidth: 560 }}>{description}</div>
      </div>
      {action ? <div style={{ marginTop: 6 }}>{action}</div> : null}
    </div>
  );
}
