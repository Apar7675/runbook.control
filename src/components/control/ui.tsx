import Link from "next/link";
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
      ? theme.text.accentSoft
      : tone === "healthy"
        ? "#c7f6dc"
        : tone === "warning"
          ? "#ffe7be"
          : tone === "critical"
            ? "#ffd2d2"
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
      background: "rgba(86, 220, 154, 0.10)",
      borderColor: "rgba(86, 220, 154, 0.20)",
      color: "#c7f6dc",
      glow: "rgba(86, 220, 154, 0.34)",
    };
  }
  if (tone === "warning") {
    return {
      background: "rgba(255, 196, 107, 0.12)",
      borderColor: "rgba(255, 196, 107, 0.22)",
      color: "#ffe7be",
      glow: "rgba(255, 196, 107, 0.34)",
    };
  }
  if (tone === "critical") {
    return {
      background: "rgba(255, 119, 119, 0.14)",
      borderColor: "rgba(255, 119, 119, 0.25)",
      color: "#ffd2d2",
      glow: "rgba(255, 119, 119, 0.34)",
    };
  }
  return {
    background: "rgba(148, 164, 255, 0.11)",
    borderColor: "rgba(148, 164, 255, 0.20)",
    color: "#d7dcff",
    glow: "rgba(148, 164, 255, 0.28)",
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
        gap: 8,
        minHeight: 28,
        padding: "4px 10px",
        borderRadius: theme.radius.pill,
        border: `1px solid ${styles.borderColor}`,
        background: styles.background,
        color: styles.color,
        fontSize: 10,
        fontWeight: 900,
        letterSpacing: 0.62,
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: theme.radius.pill,
          background: styles.color,
          boxShadow: `0 0 14px ${styles.glow}`,
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
        gap: 20,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "grid", gap: 10, maxWidth: 840 }}>
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
              fontSize: 14,
              lineHeight: 1.62,
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
            gap: 10,
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
        gap: 9,
        minHeight: 42,
        padding: primary ? "10px 15px" : "10px 14px",
        borderRadius: theme.radius.md,
        textDecoration: "none",
        fontWeight: 900,
        letterSpacing: 0.14,
        color: primary ? "#f7f9ff" : theme.text.primary,
        border: primary ? theme.border.accentStrong : theme.border.accentSoft,
        background: primary
          ? "linear-gradient(135deg, rgba(88,107,255,0.78), rgba(70,170,255,0.34) 60%, rgba(116,108,255,0.32))"
          : "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))",
        boxShadow: primary
          ? "0 14px 32px rgba(27,52,138,0.34)"
          : theme.shadow.button,
        whiteSpace: "nowrap",
      }}
    >
      {icon ? <Icon name={icon} size={15} tone={primary ? "accent" : "neutral"} /> : null}
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
          valueColor: "#fff2f2",
          titleColor: "#ffd3d3",
          iconTone: "critical" as const,
        }
      : tone === "warning"
        ? {
            background: theme.bg.panelWarning,
            border: theme.border.warning,
            boxShadow: theme.shadow.warning,
            valueColor: "#fff7eb",
            titleColor: "#ffe2b2",
            iconTone: "warning" as const,
          }
        : tone === "healthy"
          ? {
              background: theme.bg.panelHealthy,
              border: theme.border.healthy,
              boxShadow: "none",
              valueColor: theme.text.primary,
              titleColor: "#c8f4dc",
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
        borderRadius: theme.radius.lg,
        border: toneStyles.border,
        background: toneStyles.background,
        padding: "16px 16px 14px",
        minHeight: 148,
        display: "grid",
        alignContent: "space-between",
        gap: 14,
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
      <div style={{ position: "relative", zIndex: 1, display: "grid", gap: 14 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "flex-start",
          }}
        >
          <div style={{ display: "grid", gap: 12, minWidth: 0 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span
                style={{
                  width: 34,
                  height: 34,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.04)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
                  flexShrink: 0,
                }}
              >
                <Icon
                  name={icon ?? "spark"}
                  size={16}
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
                fontSize: 28,
                fontWeight: 900,
                lineHeight: 1.02,
                letterSpacing: -0.56,
                color: toneStyles.valueColor,
              }}
            >
              {value}
            </div>
          </div>
          {badge ? <div style={{ display: "flex", justifyContent: "flex-end" }}>{badge}</div> : null}
        </div>
        <div style={{ color: theme.text.secondary, lineHeight: 1.55, fontSize: 13 }}>
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
    <div style={{ display: "grid", gap: 14 }}>
      {items.map((item) => (
        <div
          key={item.label}
          style={{
            display: "grid",
            gridTemplateColumns: "140px minmax(0, 1fr)",
            gap: 14,
            alignItems: "start",
          }}
        >
          <div style={{ color: theme.text.quiet, ...theme.type.label }}>{item.label}</div>
          <div
            style={{
              color: theme.text.primary,
              fontSize: 13,
              fontWeight: 800,
              lineHeight: 1.5,
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
  minHeight: 42,
  borderRadius: theme.radius.md,
  border: theme.border.accentSoft,
  background: theme.bg.panelInset,
  color: theme.text.primary,
  padding: "10px 12px",
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,0.04), 0 10px 24px rgba(0,0,0,0.18)",
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
          background:
            "linear-gradient(135deg, rgba(96,134,198,0.82), rgba(90,130,214,0.38) 60%, rgba(109,130,255,0.24))",
          color: "#f7f9ff",
          boxShadow: "0 14px 28px rgba(27, 52, 138, 0.30)",
        }
      : tone === "danger"
        ? {
            border: theme.border.critical,
            background:
              "linear-gradient(180deg, rgba(64,24,28,0.94), rgba(29,16,18,0.94))",
            color: "#ffd8d8",
          }
        : {
            border: theme.border.accentSoft,
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))",
            color: theme.text.primary,
            boxShadow: theme.shadow.button,
          };

  return (
    <button
      {...props}
      style={{
        minHeight: 40,
        borderRadius: theme.radius.md,
        padding: "9px 13px",
        fontWeight: 900,
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
        border: "1px dashed rgba(255,255,255,0.14)",
        background:
          "radial-gradient(circle at top left, rgba(122,157,214,0.10), transparent 26%), linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015))",
        padding: 30,
        display: "grid",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <span
          style={{
            width: 36,
            height: 36,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 12,
            border: "1px solid rgba(122,157,214,0.18)",
            background: "rgba(122,157,214,0.08)",
          }}
        >
          <Icon name="spark" size={18} tone="accent" />
        </span>
        <div style={{ fontWeight: 900, fontSize: 24, letterSpacing: -0.32 }}>
          {title}
        </div>
      </div>
      <div style={{ color: theme.text.secondary, lineHeight: 1.62, maxWidth: 640 }}>
        {description}
      </div>
      {action ? (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{action}</div>
      ) : null}
    </div>
  );
}
