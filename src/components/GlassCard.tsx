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
        position: "relative",
        overflow: "hidden",
        padding: 14,
        borderRadius: 16,
        border: surface.border,
        background: surface.background,
        backdropFilter: "blur(14px)",
        boxShadow: surface.boxShadow,
        color: theme.text.primary,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 1,
          borderRadius: 21,
          pointerEvents: "none",
          background:
            tone === "critical"
              ? "radial-gradient(circle at top right, rgba(222,118,118,0.12), transparent 34%), linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))"
              : tone === "warning"
              ? "radial-gradient(circle at top right, rgba(226,174,88,0.12), transparent 34%), linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))"
              : "radial-gradient(circle at top right, rgba(126,171,217,0.10), transparent 34%), linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
        }}
      />
      {(title || subtitle || actions) && (
        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "flex-start",
            marginBottom: 12,
            paddingBottom: 10,
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div style={{ display: "grid", gap: 5, maxWidth: 760 }}>
            {title ? (
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 900,
                  letterSpacing: 0.18,
                  color: tone === "critical" ? "#ffd3d3" : tone === "warning" ? "#ffe2b2" : theme.text.accentSoft,
                  textTransform: "uppercase",
                }}
              >
                {title}
              </div>
            ) : null}
            {subtitle ? <div style={{ color: theme.text.secondary, fontSize: 11.5, lineHeight: 1.4 }}>{subtitle}</div> : null}
          </div>
          {actions ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{actions}</div> : null}
        </div>
      )}

      <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
    </div>
  );
}
