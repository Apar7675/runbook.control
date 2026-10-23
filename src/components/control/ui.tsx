import Link from "@/components/control/CompanyLink";
import React from "react";
import GlassCard from "@/components/GlassCard";
import { theme } from "@/lib/ui/theme";

type IconName =
  | "spark"
  | "billing"
  | "apps"
  | "devices"
  | "people"
  | "warning"
  | "activity"
  | "access"
  | "shop"
  | "updates"
  | "audit"
  | "settings"
  | "support"
  | "arrow";

export function toneFromStatus(status: string) {
  const normalized = String(status ?? "").trim().toLowerCase();
  if (
    [
      "healthy",
      "active",
      "connected",
      "full access",
      "full",
      "ok",
      "ready",
      "people ready",
      "devices healthy",
      "billing healthy",
      "all connected",
    ].includes(normalized)
  ) {
    return "healthy";
  }
  if (
    [
      "warning",
      "degraded",
      "pending",
      "queue-only",
      "queue_only",
      "read-only",
      "read_only",
      "devices need attention",
      "trial ending soon",
    ].includes(normalized)
  ) {
    return "warning";
  }
  if (
    [
      "blocked",
      "restricted",
      "offline",
      "action needed",
      "action_needed",
      "devices need review",
      "people need access review",
      "billing needs review",
      "billing restricted",
      "workstation degraded",
      "mobile restricted",
      "desktop reduced",
    ].includes(normalized)
  ) {
    return "critical";
  }
  return "neutral";
}

export function Icon({
  name,
  size = 16,
  tone = "neutral",
}: {
  name: IconName;
  size?: number;
  tone?: "neutral" | "accent" | "healthy" | "warning" | "critical";
}) {
  const color =
    tone === "accent"
      ? "currentColor"
      : tone === "healthy"
        ? "#007452"
        : tone === "warning"
          ? "#985600"
          : tone === "critical"
            ? "#bb2b37"
            : theme.text.secondary;

  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (name === "billing") {
    return (
      <svg {...common}>
        <path d="M4 7h16" />
        <path d="M6 4h12l2 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8l2-4Z" />
        <path d="M12 11v5" />
        <path d="M9.5 13.5H14" />
      </svg>
    );
  }
  if (name === "apps") {
    return (
      <svg {...common}>
        <rect x="4" y="4" width="7" height="7" rx="2" />
        <rect x="13" y="4" width="7" height="7" rx="2" />
        <rect x="4" y="13" width="7" height="7" rx="2" />
        <rect x="13" y="13" width="7" height="7" rx="2" />
      </svg>
    );
  }
  if (name === "devices") {
    return (
      <svg {...common}>
        <rect x="4" y="5" width="16" height="10" rx="2" />
        <path d="M10 19h4" />
        <path d="M12 15v4" />
      </svg>
    );
  }
  if (name === "people") {
    return (
      <svg {...common}>
        <path d="M16 19a4 4 0 0 0-8 0" />
        <circle cx="12" cy="10" r="3" />
        <path d="M6 19a3 3 0 0 0-2-2.8" />
        <path d="M18 19a3 3 0 0 1 2-2.8" />
      </svg>
    );
  }
  if (name === "warning") {
    return (
      <svg {...common}>
        <path d="m12 4 8 14H4l8-14Z" />
        <path d="M12 10v4" />
        <path d="M12 17h.01" />
      </svg>
    );
  }
  if (name === "activity") {
    return (
      <svg {...common}>
        <path d="M4 12h4l2-4 4 8 2-4h4" />
      </svg>
    );
  }
  if (name === "shop") {
    return (
      <svg {...common}>
        <path d="M4 10.5 12 4l8 6.5" />
        <path d="M6 9.5V20h12V9.5" />
        <path d="M10 20v-5h4v5" />
      </svg>
    );
  }
  if (name === "updates") {
    return (
      <svg {...common}>
        <path d="M12 4v8" />
        <path d="m8.5 8 3.5 4 3.5-4" />
        <rect x="4" y="15" width="16" height="5" rx="2" />
      </svg>
    );
  }
  if (name === "audit") {
    return (
      <svg {...common}>
        <path d="M8 4h8" />
        <path d="M9 2h6v4H9z" />
        <rect x="6" y="6" width="12" height="16" rx="2" />
        <path d="M9 11h6" />
        <path d="M9 15h6" />
      </svg>
    );
  }
  if (name === "access") {
    return (
      <svg {...common}>
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V8a4 4 0 1 1 8 0v3" />
      </svg>
    );
  }
  if (name === "settings") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="3.25" />
        <path d="M12 3.5v2.2" />
        <path d="M12 18.3v2.2" />
        <path d="m5.9 5.9 1.6 1.6" />
        <path d="m16.5 16.5 1.6 1.6" />
        <path d="M3.5 12h2.2" />
        <path d="M18.3 12h2.2" />
        <path d="m5.9 18.1 1.6-1.6" />
        <path d="m16.5 7.5 1.6-1.6" />
      </svg>
    );
  }
  if (name === "support") {
    return (
      <svg {...common}>
        <path d="M8.5 10a3.5 3.5 0 1 1 5.8 2.6c-.9.8-1.8 1.4-1.8 2.4" />
        <path d="M12 18h.01" />
        <circle cx="12" cy="12" r="9" />
      </svg>
    );
  }
  if (name === "arrow") {
    return (
      <svg {...common}>
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M12 3v6" />
      <path d="M12 15v6" />
      <path d="M3 12h6" />
      <path d="M15 12h6" />
    </svg>
  );
}

function badgePalette(tone: "healthy" | "warning" | "critical" | "neutral") {
  if (tone === "healthy") {
    return {
      background: "#e5f7f0",
      borderColor: "#bfe9da",
      color: "#007452",
      glow: "rgba(0, 140, 104, 0.12)",
    };
  }
  if (tone === "warning") {
    return {
      background: "#fff3df",
      borderColor: "#f4deb4",
      color: "#985600",
      glow: "rgba(173, 97, 0, 0.12)",
    };
  }
  if (tone === "critical") {
    return {
      background: "#fff0f1",
      borderColor: "#f4c9cb",
      color: "#bb2b37",
      glow: "rgba(187, 43, 55, 0.12)",
    };
  }
  return {
    background: "#eef2ff",
    borderColor: "#dce5ff",
    color: "#263d79",
    glow: "rgba(7, 85, 255, 0.08)",
  };
}

export function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: "healthy" | "warning" | "critical" | "neutral";
}) {
  const styles = badgePalette(tone);

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        minHeight: 24,
        padding: "3px 8px",
        borderRadius: theme.radius.pill,
        border: `1px solid ${styles.borderColor}`,
        background: styles.background,
        color: styles.color,
        fontSize: 11.5,
        fontWeight: 700,
        letterSpacing: 0,
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: theme.radius.pill,
          background: styles.color,
          boxShadow: `0 0 10px ${styles.glow}`,
        }}
      />
      {label}
    </span>
  );
}

export function PageHeader({
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
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
        gap: 14,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "grid", gap: 6, maxWidth: 840 }}>
        {eyebrow ? (
          <div style={{ color: theme.text.accentSoft, ...theme.type.label }}>
            {eyebrow}
          </div>
        ) : null}
        <h1 style={{ margin: 0, ...theme.type.display }}>{title}</h1>
        {description ? (
          <div
            style={{
              color: theme.text.muted,
              fontSize: 13,
              lineHeight: 1.52,
              maxWidth: 780,
            }}
          >
            {description}
          </div>
        ) : null}
      </div>

      {actions ? (
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          {actions}
        </div>
      ) : null}
    </div>
  );
}

export function ActionLink({
  href,
  children,
  tone = "secondary",
  icon,
}: {
  href: string;
  children: React.ReactNode;
  tone?: "primary" | "secondary";
  icon?: IconName;
}) {
  const primary = tone === "primary";

  return (
    <Link
      href={href}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        minHeight: 36,
        padding: primary ? "8px 12px" : "8px 11px",
        borderRadius: theme.radius.md,
        textDecoration: "none",
        fontWeight: 700,
        letterSpacing: 0.14,
        color: primary ? "#ffffff" : theme.text.accent,
        border: primary ? theme.border.accentStrong : theme.border.accentSoft,
        background: primary
          ? "#0755ff"
          : "#ffffff",
        boxShadow: primary
          ? "0 8px 16px rgba(27,52,138,0.18)"
          : theme.shadow.button,
        whiteSpace: "nowrap",
      }}
    >
      {icon ? <Icon name={icon} size={13} tone={primary ? "accent" : "neutral"} /> : null}
      <span>{children}</span>
    </Link>
  );
}

export function SectionBlock({
  title,
  description,
  actions,
  children,
  tone = "default",
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  tone?: "default" | "subtle" | "healthy" | "warning" | "critical";
}) {
  return (
    <GlassCard title={title} subtitle={description} actions={actions} tone={tone}>
      {children}
    </GlassCard>
  );
}

export function MetricCard({
  title,
  value,
  summary,
  href,
  badge,
  tone = "default",
  icon,
}: {
  title: string;
  value: string;
  summary: string;
  href?: string;
  badge?: React.ReactNode;
  tone?: "default" | "healthy" | "warning" | "critical" | "subtle";
  icon?: IconName;
}) {
  const toneStyles =
    tone === "critical"
      ? {
          background: theme.bg.panelCritical,
          border: theme.border.critical,
          boxShadow: theme.shadow.critical,
          valueColor: "#bb2b37",
          titleColor: "#bb2b37",
          iconTone: "critical" as const,
        }
      : tone === "warning"
        ? {
            background: theme.bg.panelWarning,
            border: theme.border.warning,
            boxShadow: theme.shadow.warning,
            valueColor: "#985600",
            titleColor: "#985600",
            iconTone: "warning" as const,
          }
        : tone === "healthy"
          ? {
              background: theme.bg.panelHealthy,
              border: theme.border.healthy,
              boxShadow: "none",
              valueColor: theme.text.primary,
              titleColor: "#007452",
              iconTone: "healthy" as const,
            }
          : tone === "subtle"
            ? {
                background: theme.bg.panelSoft,
                border: theme.border.muted,
                boxShadow: "none",
                valueColor: theme.text.primary,
                titleColor: theme.text.muted,
                iconTone: "neutral" as const,
              }
            : {
                background: theme.bg.panelRaised,
                border: theme.border.soft,
                boxShadow: theme.shadow.raised,
                valueColor: theme.text.primary,
                titleColor: theme.text.muted,
                iconTone: "accent" as const,
              };

  const body = (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: theme.radius.md,
        border: toneStyles.border,
        background: toneStyles.background,
        padding: "10px 11px",
        minHeight: 78,
        display: "grid",
        alignContent: "center",
        gap: 8,
        boxShadow: toneStyles.boxShadow,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at top right, rgba(255,255,255,0.05), transparent 28%), radial-gradient(circle at left center, rgba(122,157,214,0.08), transparent 32%)",
          pointerEvents: "none",
        }}
      />
      <div style={{ position: "relative", zIndex: 1, display: "grid", gap: 8 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            alignItems: "flex-start",
          }}
        >
          <div style={{ display: "grid", gap: 6, minWidth: 0 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span
                style={{
                  width: 24,
                  height: 24,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 10,
                  border: theme.border.soft,
                  background: theme.bg.panelSoft,
                  flexShrink: 0,
                }}
              >
                <Icon
                  name={icon ?? "spark"}
                  size={12}
                  tone={toneStyles.iconTone}
                />
              </span>
              <div
                style={{
                  color: toneStyles.titleColor,
                  ...theme.type.label,
                }}
              >
                {title}
              </div>
            </div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 900,
                lineHeight: 1.02,
                letterSpacing: -0.42,
                color: toneStyles.valueColor,
              }}
            >
              {value}
            </div>
          </div>
          {badge ? <div style={{ display: "flex", justifyContent: "flex-end" }}>{badge}</div> : null}
        </div>
        <div style={{ color: theme.text.secondary, lineHeight: 1.35, fontSize: 11.5 }}>
          {summary}
        </div>
      </div>
    </div>
  );

  if (!href) return body;

  return (
    <Link
      href={href}
      style={{ textDecoration: "none", color: "inherit", display: "block" }}
    >
      {body}
    </Link>
  );
}

export function DataList({
  items,
}: {
  items: Array<{ label: string; value: React.ReactNode }>;
}) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {items.map((item) => (
        <div
          key={item.label}
          style={{
            display: "grid",
            gridTemplateColumns: "120px minmax(0, 1fr)",
            gap: 10,
            alignItems: "start",
          }}
        >
          <div style={{ color: theme.text.quiet, ...theme.type.label }}>{item.label}</div>
          <div
            style={{
              color: theme.text.primary,
              fontSize: 12.5,
              fontWeight: 800,
              lineHeight: 1.4,
            }}
          >
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}

const fieldBaseStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  minHeight: 36,
  borderRadius: theme.radius.md,
  border: theme.border.accentSoft,
  background: theme.bg.panelInset,
  color: theme.text.primary,
  padding: "7px 10px",
  boxShadow: "none",
};

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ color: theme.text.quiet, ...theme.type.label }}>{children}</label>
  );
}

export function ControlInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ ...fieldBaseStyle, ...(props.style ?? {}) }} />;
}

export function ControlSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} style={{ ...fieldBaseStyle, ...(props.style ?? {}) }} />;
}

export function ControlButton({
  children,
  tone = "secondary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "primary" | "secondary" | "danger";
}) {
  const toneStyle: React.CSSProperties =
    tone === "primary"
      ? {
          border: theme.border.accentStrong,
          background: "#0755ff",
          color: "#ffffff",
          boxShadow: "0 8px 16px rgba(27, 52, 138, 0.20)",
        }
      : tone === "danger"
        ? {
            border: theme.border.critical,
            background: "#fff0f1",
            color: "#bb2b37",
          }
        : {
            border: theme.border.accentSoft,
            background: "#ffffff",
            color: theme.text.accent,
            boxShadow: theme.shadow.button,
          };

  return (
    <button
      {...props}
      style={{
        minHeight: 34,
        borderRadius: theme.radius.md,
        padding: "7px 11px",
        fontWeight: 700,
        letterSpacing: 0.12,
        cursor: props.disabled ? "not-allowed" : "pointer",
        opacity: props.disabled ? 0.68 : 1,
        transition:
          "transform 140ms ease, box-shadow 160ms ease, border-color 160ms ease, background 160ms ease",
        ...toneStyle,
        ...(props.style ?? {}),
      }}
    >
      {children}
    </button>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: theme.radius.xl,
        border: "1px dashed #c8d6ff",
        background: "#f5f7ff",
        padding: 20,
        display: "grid",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span
          style={{
            width: 30,
            height: 30,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 10,
            border: "1px solid rgba(122,157,214,0.18)",
            background: "rgba(122,157,214,0.08)",
          }}
        >
          <Icon name="spark" size={15} tone="accent" />
        </span>
        <div style={{ fontWeight: 900, fontSize: 20, letterSpacing: -0.24 }}>
          {title}
        </div>
      </div>
      <div style={{ color: theme.text.secondary, lineHeight: 1.5, maxWidth: 640 }}>
        {description}
      </div>
      {action ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{action}</div>
      ) : null}
    </div>
  );
}
