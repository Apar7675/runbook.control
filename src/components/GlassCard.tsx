import React from "react";
import { theme } from "@/lib/ui/theme";

type Tone = "default" | "subtle" | "healthy" | "warning" | "critical";

function surfaceForTone(tone: Tone) {
  if (tone === "healthy") {
    return { background: theme.bg.panelHealthy, border: theme.border.healthy, boxShadow: theme.shadow.healthy };
  }
  if (tone === "warning") {
    return { background: theme.bg.panelWarning, border: theme.border.warning, boxShadow: theme.shadow.warning };
  }
  if (tone === "critical") {
    return { background: theme.bg.panelCritical, border: theme.border.critical, boxShadow: theme.shadow.critical };
  }
  if (tone === "subtle") {
    return { background: theme.bg.panelSoft, border: theme.border.muted, boxShadow: "none" };
  }
  return { background: theme.bg.panel, border: theme.border.soft, boxShadow: theme.shadow.panel };
}

export default function GlassCard({
  title,
  subtitle,
  actions,
  tone = "default",
  children,
}: {
  title?: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  tone?: Tone;
  children: React.ReactNode;
}) {
  const surface = surfaceForTone(tone);

  return (
    <div
      style={{
        padding: 20,
        borderRadius: theme.radius.xl,
        border: surface.border,
        background: surface.background,
        backdropFilter: "blur(14px)",
        boxShadow: surface.boxShadow,
        color: theme.text.primary,
      }}
    >
      {(title || subtitle || actions) && (
        <div style={{ display: "flex", justifyContent: "space-between", gap: 18, alignItems: "flex-start", marginBottom: 16 }}>
          <div style={{ display: "grid", gap: 8 }}>
            {title ? (
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 900,
                  letterSpacing: 0.8,
                  color: tone === "critical" ? "#ffd3d3" : tone === "warning" ? "#ffe2b2" : theme.text.accentSoft,
                  textTransform: "uppercase",
                }}
              >
                {title}
              </div>
            ) : null}
            {subtitle ? <div style={{ color: theme.text.secondary, fontSize: 13, lineHeight: 1.5 }}>{subtitle}</div> : null}
          </div>
          {actions ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{actions}</div> : null}
        </div>
      )}

      {children}
    </div>
  );
}
