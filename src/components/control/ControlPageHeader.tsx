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
    <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-end", flexWrap: "wrap" }}>
      <div style={{ display: "grid", gap: 5 }}>
        {eyebrow ? (
          <div
            style={{
              color: t.color.textMuted,
              fontSize: 10.5,
              fontWeight: 800,
              letterSpacing: 0.6,
              textTransform: "uppercase",
            }}
          >
            {eyebrow}
          </div>
        ) : null}
        <div style={{ display: "grid", gap: 4 }}>
          <h1 style={{ margin: 0, fontSize: 30, lineHeight: 1.1, fontWeight: 800, color: t.color.text }}>{title}</h1>
          {description ? <div style={{ maxWidth: 920, fontSize: 13.5, lineHeight: 1.45, color: t.color.textMuted }}>{description}</div> : null}
        </div>
      </div>
      {actions ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{actions}</div> : null}
    </div>
  );
}
