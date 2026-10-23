import React from "react";
import { controlTheme as t } from "@/components/control/controlTheme";

export default function ControlPageHeader({
  eyebrow,
  title,
  description,
  actions,
  compact = false,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className="control-page-header" style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <div style={{ display: "grid", gap: 3 }}>
        {eyebrow ? (
          <div
            style={{
              color: t.color.textMuted,
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: 0.6,
              textTransform: "uppercase",
            }}
          >
            {eyebrow}
          </div>
        ) : null}
        <div style={{ display: "grid", gap: 2 }}>
          <h1 style={{ margin: 0, fontSize: compact ? 26 : 28, lineHeight: 1.15, fontWeight: 700, letterSpacing: -0.4, color: t.color.text }}>{title}</h1>
          {description ? <div className="control-page-description" style={{ maxWidth: 920, fontSize: 14, lineHeight: 1.45, color: t.color.textMuted }}>{description}</div> : null}
        </div>
      </div>
      {actions ? <div className="control-page-actions" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{actions}</div> : null}
    </div>
  );
}
