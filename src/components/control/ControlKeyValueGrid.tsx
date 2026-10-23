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
    <div className="control-key-value-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 160px), 1fr))", gap: 8 }}>
      {items.map((item) => (
        <div
          key={item.label}
          className="control-key-value-item"
          style={{
            display: "grid",
            gap: 4,
            padding: "6px 8px",
            borderRadius: t.radius.md,
            border: `1.25px solid ${t.color.border}`,
            background: t.color.elevated,
            minHeight: 54,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", color: t.color.textMuted }}>
            {item.label}
          </div>
          <div style={{ color: t.color.textSecondary, fontSize: 14, lineHeight: 1.5 }}>{item.value}</div>
        </div>
      ))}
    </div>
  );
}
