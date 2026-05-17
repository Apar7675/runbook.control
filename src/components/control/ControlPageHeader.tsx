import React from "react";
import { controlTheme as t } from "@/components/control/controlTheme";

export default function ControlPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 18, alignItems: "flex-end", flexWrap: "wrap" }}>
      <div style={{ display: "grid", gap: 8 }}>
        {eyebrow ? (
          <div
            style={{
              color: t.color.textMuted,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 0.8,
              textTransform: "uppercase",
            }}
          >
            {eyebrow}
          </div>
        ) : null}
        <div style={{ display: "grid", gap: 6 }}>
          <h1 style={{ margin: 0, fontSize: 38, lineHeight: 1.05, fontWeight: 800, color: t.color.text }}>{title}</h1>
          {description ? <div style={{ maxWidth: 920, fontSize: 15, color: t.color.textMuted }}>{description}</div> : null}
        </div>
      </div>
      {actions ? <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{actions}</div> : null}
    </div>
  );
}
