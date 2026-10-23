import React from "react";
import { theme } from "@/lib/ui/theme";

type Tone = "default" | "subtle" | "healthy" | "warning" | "critical";

function surfaceForTone(tone: Tone) {
  if (tone === "healthy") {
    return {
      background: theme.bg.panelHealthy,
      border: theme.border.healthy,
      boxShadow: theme.shadow.healthy,
      labelColor: "#007452",
      glow: "rgba(86,220,154,0.12)",
    };
  }
  if (tone === "warning") {
    return {
      background: theme.bg.panelWarning,
      border: theme.border.warning,
      boxShadow: theme.shadow.warning,
      labelColor: "#985600",
      glow: "rgba(226,174,88,0.12)",
    };
  }
  if (tone === "critical") {
    return {
      background: theme.bg.panelCritical,
      border: theme.border.critical,
      boxShadow: theme.shadow.critical,
      labelColor: "#bb2b37",
      glow: "rgba(222,118,118,0.13)",
    };
  }
  if (tone === "subtle") {
    return {
      background: theme.bg.panelSoft,
      border: theme.border.muted,
      boxShadow: "none",
      labelColor: theme.text.accentSoft,
      glow: "rgba(122,157,214,0.08)",
    };
  }
  return {
    background: theme.bg.panel,
    border: theme.border.soft,
    boxShadow: theme.shadow.panel,
    labelColor: theme.text.accentSoft,
    glow: "rgba(122,157,214,0.12)",
  };
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
    <section
      style={{
        position: "relative",
        overflow: "hidden",
        padding: 12,
        borderRadius: theme.radius.xl,
        border: surface.border,
        background: surface.background,
        boxShadow: surface.boxShadow,
        color: theme.text.primary,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: `radial-gradient(circle at top left, ${surface.glow}, transparent 22%), radial-gradient(circle at top right, rgba(255,255,255,0.025), transparent 18%)`,
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 1,
          borderRadius: theme.radius.xl - 1,
          pointerEvents: "none",
          border: "1px solid rgba(255,255,255,0.035)",
        }}
      />

      {(title || subtitle || actions) && (
        <div
          className="control-panel-heading"
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "flex-start",
            margin: "-12px -12px 12px",
            padding: "9px 16px",
            borderBottom: "1px solid #dce5ff",
            background: "#06245D",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "grid", gap: 4, maxWidth: 760 }}>
            {title ? (
              <div
                style={{
                  color: "#ffffff",
                  ...theme.type.label,
                  fontSize: 14,
                  fontWeight: 700,
                  letterSpacing: 0.15,
                }}
              >
                {title}
              </div>
            ) : null}
            {subtitle ? (
              <div
                style={{
                  color: "#e0eaff",
                  fontSize: 12,
                  lineHeight: 1.42,
                }}
              >
                {subtitle}
              </div>
            ) : null}
          </div>
          {actions ? (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{actions}</div>
          ) : null}
        </div>
      )}

      <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
    </section>
  );
}
