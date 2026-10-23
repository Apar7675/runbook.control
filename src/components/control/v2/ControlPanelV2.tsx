import React from "react";
import { controlV2Theme as t } from "@/components/control/v2/controlV2Theme";

export default function ControlPanelV2({
  title,
  description,
  actions,
  children,
}: {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        display: "grid",
        gap: 10,
        minWidth: 0,
        padding: 12,
        overflow: "hidden",
        borderRadius: t.radius.md,
        border: `1.25px solid ${t.color.border}`,
        background: t.color.support,
      }}
    >
      {title || description || actions ? (
        <div className="control-panel-heading" style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap", margin: "-12px -12px 0", padding: "9px 16px", backgroundColor: "#06245D" }}>
          <div style={{ display: "grid", gap: 3 }}>
            {title ? <div style={{ fontSize: 14, fontWeight: 700, color: "#ffffff", textTransform: "uppercase", letterSpacing: 0.15 }}>{title}</div> : null}
            {description ? <div style={{ fontSize: 12, color: "#e0eaff", lineHeight: 1.45 }}>{description}</div> : null}
          </div>
          {actions ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
