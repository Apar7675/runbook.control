import React from "react";
import { controlTheme as t } from "@/components/control/controlTheme";

export default function ControlPanel({
  title,
  description,
  actions,
  children,
  padding = 14,
}: {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  padding?: number;
}) {
  return (
    <section
      style={{
        display: "grid",
        gap: 12,
        padding,
        borderRadius: t.radius.md,
        border: `1px solid ${t.color.softBorder}`,
        background: `linear-gradient(180deg, rgba(18, 27, 40, 0.98), rgba(11, 16, 24, 0.98))`,
        boxShadow: t.shadow.panel,
        backdropFilter: "blur(20px)",
      }}
    >
      {title || description || actions ? (
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ display: "grid", gap: 4 }}>
            {title ? <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: t.color.text }}>{title}</h2> : null}
            {description ? <div style={{ fontSize: 12.5, lineHeight: 1.45, color: t.color.textMuted, maxWidth: 880 }}>{description}</div> : null}
          </div>
          {actions ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
