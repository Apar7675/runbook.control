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
        gap: 8,
        justifyItems: "start",
        padding: "12px 0",
      }}
    >
      <div style={{ width: 28, height: 3, borderRadius: t.radius.pill, background: t.color.blue }} />
      <div style={{ display: "grid", gap: 4 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: t.color.text }}>{title}</div>
        <div style={{ fontSize: 12.5, lineHeight: 1.5, color: t.color.textMuted, maxWidth: 620 }}>{description}</div>
      </div>
      {action ? <div style={{ marginTop: 2 }}>{action}</div> : null}
    </div>
  );
}
