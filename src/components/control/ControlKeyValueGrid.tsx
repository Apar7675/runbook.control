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
            gap: 4,
            padding: "10px 11px",
            borderRadius: t.radius.md,
            border: `1px solid ${t.color.softBorder}`,
            background: "rgba(7, 10, 15, 0.36)",
            minHeight: 62,
          }}
        >
          <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase", color: t.color.textMuted }}>
            {item.label}
          </div>
          <div style={{ color: t.color.textSecondary, fontSize: 12.5, lineHeight: 1.45 }}>{item.value}</div>
        </div>
      ))}
    </div>
  );
}
