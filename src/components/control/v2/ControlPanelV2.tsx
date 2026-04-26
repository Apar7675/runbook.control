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
        padding: 12,
        borderRadius: t.radius.md,
        border: `1px solid ${t.color.border}`,
        background: t.color.surface,
      }}
    >
      {title || description || actions ? (
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ display: "grid", gap: 3 }}>
            {title ? <div style={{ fontSize: 13, fontWeight: 700, color: t.color.text }}>{title}</div> : null}
            {description ? <div style={{ fontSize: 12, color: t.color.textQuiet, lineHeight: 1.45 }}>{description}</div> : null}
          </div>
          {actions ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
