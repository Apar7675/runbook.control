import React from "react";
import { controlV2Theme as t } from "@/components/control/v2/controlV2Theme";

export default function ControlMetricStripV2({
  items,
}: {
  items: Array<{ label: string; value: React.ReactNode; meta?: React.ReactNode }>;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`, gap: 10 }}>
      {items.map((item) => (
        <div
          key={item.label}
          style={{
            display: "grid",
            gap: 3,
            padding: "10px 12px",
            borderRadius: t.radius.md,
            border: `1px solid ${t.color.border}`,
            background: t.color.surface,
          }}
        >
          <div style={{ color: t.color.textQuiet, ...t.type.label }}>{item.label}</div>
          <div style={{ fontSize: 21, fontWeight: 800, lineHeight: 1, letterSpacing: -0.3 }}>{item.value}</div>
          {item.meta ? <div style={{ fontSize: 12, color: t.color.textQuiet }}>{item.meta}</div> : null}
        </div>
      ))}
    </div>
  );
}
