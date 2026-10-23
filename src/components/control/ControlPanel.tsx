import React from "react";
import { controlTheme as t } from "@/components/control/controlTheme";

export default function ControlPanel({
  title,
  description,
  actions,
  children,
  padding = 8,
  surface = "support",
}: {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  padding?: number;
  surface?: "support" | "work";
}) {
  return (
    <section
      style={{
        display: "grid",
        alignContent: "start",
        gap: 8,
        padding,
        borderRadius: 9,
        border: `1.25px solid ${t.color.border}`,
        background: surface === "work" ? t.color.surface : t.color.support,
        boxShadow: t.shadow.panel,
        minWidth: 0,
        overflow: "hidden",
      }}
    >
      {title || description || actions ? (
        <div className="control-panel-heading" style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap", minHeight: 34, padding: "7px 10px", margin: `-${padding}px -${padding}px 0`, backgroundColor: "#06245D" }}>
          <div style={{ display: "grid", gap: 2 }}>
            {title ? <h2 style={{ margin: 0, fontSize: 16, lineHeight: 1.25, fontWeight: 600, color: "#FFFFFF", textTransform: "uppercase" }}>{title}</h2> : null}
            {description ? <div style={{ fontSize: 13, lineHeight: 1.45, color: "#DFE9FF", maxWidth: 880 }}>{description}</div> : null}
          </div>
          {actions ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
