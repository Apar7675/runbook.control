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
  if (["healthy", "active", "connected", "full access", "full", "ok", "ready", "people ready", "devices healthy", "billing healthy", "all connected"].includes(normalized)) {
    return "healthy";
  }
  if (["warning", "degraded", "pending", "queue-only", "queue_only", "read-only", "read_only", "devices need attention", "trial ending soon"].includes(normalized)) {
    return "warning";
  }
  if (["blocked", "restricted", "offline", "action needed", "action_needed", "devices need review", "people need access review", "billing needs review", "billing restricted", "workstation degraded", "mobile restricted", "desktop reduced"].includes(normalized)) {
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

export function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: "healthy" | "warning" | "critical" | "neutral";
}) {
  const styles =
    tone === "healthy"
      ? { background: "rgba(86, 220, 154, 0.10)", borderColor: "rgba(86, 220, 154, 0.18)", color: "#c7f6dc", glow: "rgba(86, 220, 154, 0.34)" }
      : tone === "warning"
      ? { background: "rgba(255, 196, 107, 0.12)", borderColor: "rgba(255, 196, 107, 0.22)", color: "#ffe7be", glow: "rgba(255, 196, 107, 0.34)" }
      : tone === "critical"
      ? { background: "rgba(255, 119, 119, 0.14)", borderColor: "rgba(255, 119, 119, 0.26)", color: "#ffd2d2", glow: "rgba(255, 119, 119, 0.34)" }
      : { background: "rgba(148, 164, 255, 0.11)", borderColor: "rgba(148, 164, 255, 0.20)", color: "#d7dcff", glow: "rgba(148, 164, 255, 0.28)" };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        minHeight: 26,
        padding: "4px 9px",
        borderRadius: 999,
        border: `1px solid ${styles.borderColor}`,
        background: styles.background,
        color: styles.color,
        fontSize: 9.5,
        fontWeight: 900,
        letterSpacing: 0.48,
        textTransform: "uppercase",
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: 999,
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
        gap: 18,
        flexWrap: "wrap",
        padding: "0",
      }}
    >
      <div style={{ display: "grid", gap: 8, maxWidth: 820 }}>
        {eyebrow ? (
          <div style={{ color: theme.text.accentSoft, fontSize: 10, fontWeight: 900, letterSpacing: 1.04, textTransform: "uppercase" }}>
            {eyebrow}
          </div>
        ) : null}
        <h1 style={{ margin: 0, fontSize: 33, lineHeight: 1.04, letterSpacing: -0.72 }}>{title}</h1>
        {description ? <div style={{ color: theme.text.muted, fontSize: 13, lineHeight: 1.54, maxWidth: 760 }}>{description}</div> : null}
      </div>

      {actions ? <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>{actions}</div> : null}
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
  const baseStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    minHeight: 38,
    borderRadius: 12,
    textDecoration: "none",
    fontWeight: 900,
    letterSpacing: 0.15,
    transition: "transform 140ms ease, box-shadow 160ms ease, border-color 160ms ease, background 160ms ease",
  };
  const toneStyle: React.CSSProperties = primary
    ? {
        padding: "9px 13px",
        color: "#f7f9ff",
        border: theme.border.accent,
        background: "linear-gradient(135deg, rgba(88, 107, 255, 0.72), rgba(70, 170, 255, 0.34))",
        boxShadow: "0 12px 28px rgba(27, 52, 138, 0.36)",
      }
    : {
        padding: "10px 14px",
        color: theme.text.primary,
        border: theme.border.soft,
        background: "rgba(255, 255, 255, 0.04)",
        boxShadow: "0 8px 18px rgba(0, 0, 0, 0.18)",
      };

  return (
    <Link href={href} style={{ ...baseStyle, ...toneStyle }}>
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
      ? { background: theme.bg.panelCritical, border: theme.border.critical, boxShadow: theme.shadow.critical, valueColor: "#fff2f2", titleColor: "#ffd3d3" }
      : tone === "warning"
      ? { background: theme.bg.panelWarning, border: theme.border.warning, boxShadow: theme.shadow.warning, valueColor: "#fff7eb", titleColor: "#ffe2b2" }
      : tone === "healthy"
      ? { background: theme.bg.panelHealthy, border: theme.border.healthy, boxShadow: "none", valueColor: theme.text.primary, titleColor: theme.text.muted }
      : tone === "subtle"
      ? { background: theme.bg.panelSoft, border: theme.border.muted, boxShadow: "none", valueColor: theme.text.primary, titleColor: theme.text.muted }
      : { background: theme.bg.panelRaised, border: theme.border.soft, boxShadow: theme.shadow.raised, valueColor: theme.text.primary, titleColor: theme.text.muted };

  const body = (
    <div
      style={{
        borderRadius: theme.radius.xl,
        border: toneStyles.border,
        background: toneStyles.background,
        padding: "14px 14px 13px",
        minHeight: 124,
        display: "grid",
        alignContent: "space-between",
        gap: 12,
        boxShadow: toneStyles.boxShadow,
        transition: "transform 150ms ease, box-shadow 170ms ease, border-color 170ms ease, background 170ms ease",
      }}
    >
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {icon ? <Icon name={icon} size={15} tone={tone === "critical" ? "critical" : tone === "warning" ? "warning" : tone === "healthy" ? "healthy" : "neutral"} /> : null}
              <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 0.82, textTransform: "uppercase", color: toneStyles.titleColor }}>
                {title}
              </div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, lineHeight: 1.02, letterSpacing: -0.38, color: toneStyles.valueColor }}>
              {value}
            </div>
          </div>
          {badge}
        </div>
      </div>
      <div style={{ color: theme.text.secondary, lineHeight: 1.46, fontSize: 12 }}>{summary}</div>
    </div>
  );

  if (!href) return body;

  return <Link href={href} style={{ textDecoration: "none", color: "inherit", display: "block" }}>{body}</Link>;
}

export function DataList({
  items,
}: {
  items: Array<{ label: string; value: React.ReactNode }>;
}) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {items.map((item) => (
        <div key={item.label} style={{ display: "grid", gridTemplateColumns: "122px 1fr", gap: 12, alignItems: "start" }}>
          <div style={{ color: theme.text.quiet, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.74, fontWeight: 900 }}>
            {item.label}
          </div>
          <div style={{ color: theme.text.primary, fontSize: 13, fontWeight: 800, lineHeight: 1.42 }}>{item.value}</div>
        </div>
      ))}
    </div>
  );
}

const fieldBaseStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 40,
  borderRadius: 12,
  border: theme.border.accentSoft,
  background: theme.bg.panelInset,
  color: theme.text.primary,
  padding: "10px 12px",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
};

export function FieldLabel({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <label
      style={{
        fontSize: 10,
        fontWeight: 900,
        letterSpacing: 0.74,
        textTransform: "uppercase",
        color: theme.text.quiet,
      }}
    >
      {children}
    </label>
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
          border: theme.border.accent,
          background: "linear-gradient(135deg, rgba(96, 134, 198, 0.78), rgba(90, 130, 214, 0.40))",
          color: "#f7f9ff",
          boxShadow: "0 12px 24px rgba(27, 52, 138, 0.30)",
        }
      : tone === "danger"
      ? {
          border: theme.border.critical,
          background: "linear-gradient(180deg, rgba(64,24,28,0.92), rgba(29,16,18,0.92))",
          color: "#ffd8d8",
        }
      : {
          border: theme.border.soft,
          background: "rgba(255,255,255,0.04)",
          color: theme.text.primary,
          boxShadow: "0 8px 18px rgba(0,0,0,0.18)",
        };

  return (
    <button
      {...props}
      style={{
        minHeight: 38,
        borderRadius: 12,
        padding: "8px 12px",
        fontWeight: 900,
        letterSpacing: 0.1,
        cursor: props.disabled ? "not-allowed" : "pointer",
        opacity: props.disabled ? 0.68 : 1,
        transition: "transform 140ms ease, box-shadow 160ms ease, border-color 160ms ease, background 160ms ease",
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
        borderRadius: theme.radius.xl,
        border: "1px dashed rgba(255,255,255,0.14)",
        background: "linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0.015))",
        padding: 28,
        display: "grid",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <Icon name="spark" size={18} tone="accent" />
        <div style={{ fontWeight: 900, fontSize: 22, letterSpacing: -0.2 }}>{title}</div>
      </div>
      <div style={{ color: theme.text.secondary, lineHeight: 1.58, maxWidth: 620 }}>{description}</div>
      {action ? <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{action}</div> : null}
    </div>
  );
}
