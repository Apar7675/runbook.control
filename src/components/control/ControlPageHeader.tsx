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
    <div className="control-page-header" style={{ display: "flex", justifyContent: "space-between", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
      <div style={{ display: "grid", gap: 5 }}>
        {eyebrow ? (
          <div
            style={{
              color: t.color.textMuted,
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: 0.6,
              textTransform: "uppercase",
            }}
          >
            {eyebrow}
          </div>
        ) : null}
        <div style={{ display: "grid", gap: 4 }}>
          <h1 style={{ margin: 0, fontSize: compact ? 40 : 44, lineHeight: 1.15, fontWeight: 700, letterSpacing: -0.7, color: t.color.text }}>{title}</h1>
          {description ? <div className="control-page-description" style={{ maxWidth: 920, fontSize: 20, lineHeight: 1.45, color: t.color.textMuted }}>{description}</div> : null}
        </div>
      </div>
      {actions ? <div className="control-page-actions" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>{actions}</div> : null}
    </div>
  );
}
