import React from "react";
import { controlTheme as t } from "@/components/control/controlTheme";

export type ControlKeyValueItem = {
  label: string;
  value: React.ReactNode;
};

export default function ControlKeyValueGrid({
  items,
}: {
  items: ControlKeyValueItem[];
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
      {items.map((item) => (
        <div
          key={item.label}
          style={{
            display: "grid",
            gap: 6,
            padding: "10px 12px",
            borderRadius: t.radius.md,
            border: `1.25px solid ${t.color.border}`,
            background: t.color.elevated,
            minHeight: 80,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", color: t.color.textMuted }}>
            {item.label}
          </div>
          <div style={{ color: t.color.textSecondary, fontSize: 16, lineHeight: 1.5 }}>{item.value}</div>
        </div>
      ))}
    </div>
  );
}
