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

type StatusTone = "healthy" | "warning" | "critical" | "neutral";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function toneFromStatus(status: string): StatusTone {
  const normalized = String(status ?? "").trim().toLowerCase();
  if (["healthy", "active", "connected", "full access", "full", "ok", "ready", "people ready", "devices healthy", "billing healthy", "all connected", "published", "current", "allowed", "platform admin", "aal2"].includes(normalized)) return "healthy";
  if (["warning", "degraded", "pending", "queue-only", "queue_only", "read-only", "read_only", "devices need attention", "trial ending soon", "restricted", "optional", "recent", "trialing", "disabled"].includes(normalized)) return "warning";
  if (["blocked", "offline", "action needed", "action_needed", "devices need review", "people need access review", "billing needs review", "billing restricted", "workstation degraded", "mobile restricted", "desktop reduced", "error", "disconnected", "expired", "past_due", "past due", "canceled", "required"].includes(normalized)) return "critical";
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
      ? theme.text.healthy
      : tone === "warning"
      ? theme.text.warning
      : tone === "critical"
      ? theme.text.danger
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

  if (name === "billing") return <svg {...common}><path d="M4 7h16" /><path d="M6 4h12l2 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8l2-4Z" /><path d="M12 11v5" /><path d="M9.5 13.5H14" /></svg>;
  if (name === "apps") return <svg {...common}><rect x="4" y="4" width="7" height="7" rx="2" /><rect x="13" y="4" width="7" height="7" rx="2" /><rect x="4" y="13" width="7" height="7" rx="2" /><rect x="13" y="13" width="7" height="7" rx="2" /></svg>;
  if (name === "devices") return <svg {...common}><rect x="4" y="5" width="16" height="10" rx="2" /><path d="M10 19h4" /><path d="M12 15v4" /></svg>;
  if (name === "people") return <svg {...common}><path d="M16 19a4 4 0 0 0-8 0" /><circle cx="12" cy="10" r="3" /><path d="M6 19a3 3 0 0 0-2-2.8" /><path d="M18 19a3 3 0 0 1 2-2.8" /></svg>;
  if (name === "warning") return <svg {...common}><path d="m12 4 8 14H4l8-14Z" /><path d="M12 10v4" /><path d="M12 17h.01" /></svg>;
  if (name === "activity") return <svg {...common}><path d="M4 12h4l2-4 4 8 2-4h4" /></svg>;
  if (name === "shop") return <svg {...common}><path d="M4 10.5 12 4l8 6.5" /><path d="M6 9.5V20h12V9.5" /><path d="M10 20v-5h4v5" /></svg>;
  if (name === "updates") return <svg {...common}><path d="M12 4v8" /><path d="m8.5 8 3.5 4 3.5-4" /><rect x="4" y="15" width="16" height="5" rx="2" /></svg>;
  if (name === "audit") return <svg {...common}><path d="M8 4h8" /><path d="M9 2h6v4H9z" /><rect x="6" y="6" width="12" height="16" rx="2" /><path d="M9 11h6" /><path d="M9 15h6" /></svg>;
  if (name === "access") return <svg {...common}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 1 1 8 0v3" /></svg>;
  if (name === "settings") return <svg {...common}><circle cx="12" cy="12" r="3.25" /><path d="M12 3.5v2.2" /><path d="M12 18.3v2.2" /><path d="m5.9 5.9 1.6 1.6" /><path d="m16.5 16.5 1.6 1.6" /><path d="M3.5 12h2.2" /><path d="M18.3 12h2.2" /><path d="m5.9 18.1 1.6-1.6" /><path d="m16.5 7.5 1.6-1.6" /></svg>;
  if (name === "support") return <svg {...common}><path d="M8.5 10a3.5 3.5 0 1 1 5.8 2.6c-.9.8-1.8 1.4-1.8 2.4" /><path d="M12 18h.01" /><circle cx="12" cy="12" r="9" /></svg>;
  if (name === "arrow") return <svg {...common}><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></svg>;
  return <svg {...common}><path d="M12 3v6" /><path d="M12 15v6" /><path d="M3 12h6" /><path d="M15 12h6" /></svg>;
}

export function StatusBadge({ label, tone }: { label: string; tone: StatusTone }) {
  return <span className={cx("rb-badge", `rb-badge--${tone}`)}>{label}</span>;
}

export function ShellStatusBadge({ label, tone }: { label: string; tone: StatusTone }) {
  return (
    <span className={cx("rb-shellStatus", `rb-shellStatus--${tone === "neutral" ? "healthy" : tone}`)}>
      <span className="rb-shellStatusDot" />
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
    <div className="rb-pageHeader">
      <div className="rb-pageHeader__main">
        {eyebrow ? <div className="rb-kicker">{eyebrow}</div> : null}
        <h1 className="rb-pageTitle">{title}</h1>
        {description ? <div className="rb-pageCopy">{description}</div> : null}
      </div>
      {actions ? <div className="rb-pageHeader__actions">{actions}</div> : null}
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
  tone?: "primary" | "secondary" | "danger";
  icon?: IconName;
}) {
  const toneClass = tone === "primary" ? "rb-buttonLink rb-buttonLink--primary" : tone === "danger" ? "rb-buttonLink rb-buttonLink--danger" : "rb-buttonLink rb-buttonLink--ghost";
  return (
    <Link href={href} className={toneClass}>
      {icon ? <Icon name={icon} size={15} tone={tone === "primary" ? "accent" : tone === "danger" ? "critical" : "neutral"} /> : null}
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
  tone?: "default" | "subtle" | "healthy" | "warning" | "critical" | "danger";
}) {
  return <GlassCard title={title} subtitle={description} actions={actions} tone={tone}>{children}</GlassCard>;
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
  const surface = (
    <div className={cx("rb-metricSurface", tone !== "default" && `rb-metricSurface--${tone}`)}>
      <div className="rb-metricHeader">
        <div style={{ display: "grid", gap: 10 }}>
          <div className="rb-metricLabel">
            {icon ? <Icon name={icon} size={15} tone={tone === "critical" ? "critical" : tone === "warning" ? "warning" : tone === "healthy" ? "healthy" : "neutral"} /> : null}
            <span>{title}</span>
          </div>
          <div className="rb-metricValue">{value}</div>
        </div>
        {badge}
      </div>
      <div className="rb-metricSummary">{summary}</div>
    </div>
  );

  if (!href) return surface;
  return <Link href={href} className="rb-metricCard">{surface}</Link>;
}

export function StatCallout({
  label,
  value,
  detail,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  tone?: "default" | "healthy" | "warning" | "critical" | "subtle";
}) {
  return (
    <div className={cx("rb-statCallout", tone !== "default" && `rb-statCallout--${tone}`)}>
      <div className="rb-statCalloutLabel">{label}</div>
      <div className="rb-statCalloutValue">{value}</div>
      {detail ? <div className="rb-statCalloutDetail">{detail}</div> : null}
    </div>
  );
}

export function KeyValueGrid({ items }: { items: Array<{ label: string; value: React.ReactNode }> }) {
  return (
    <div className="rb-keyValueGrid">
      {items.map((item) => (
        <div key={item.label} className="rb-keyValueItem">
          <div className="rb-keyValueLabel">{item.label}</div>
          <div className="rb-keyValueValue">{item.value}</div>
        </div>
      ))}
    </div>
  );
}

export function DataList({ items }: { items: Array<{ label: string; value: React.ReactNode }> }) {
  return (
    <div className="rb-dataList">
      {items.map((item) => (
        <div key={item.label} className="rb-dataListRow">
          <div className="rb-dataListLabel">{item.label}</div>
          <div className="rb-dataListValue">{item.value}</div>
        </div>
      ))}
    </div>
  );
}

export function NoteList({ items }: { items: Array<React.ReactNode> }) {
  return (
    <div className="rb-noteList">
      {items.map((item, index) => (
        <div key={index} className="rb-noteListItem">
          {index + 1}. {item}
        </div>
      ))}
    </div>
  );
}

export function SurfaceLink({
  href,
  title,
  description,
  icon,
}: {
  href: string;
  title: string;
  description: string;
  icon?: IconName;
}) {
  return (
    <Link href={href} className="rb-cardLink">
      <div className="rb-rowBetween">
        <div className="rb-inlineRow" style={{ fontWeight: 900 }}>
          {icon ? <Icon name={icon} size={15} tone="neutral" /> : null}
          <span>{title}</span>
        </div>
        <Icon name="arrow" size={14} tone="neutral" />
      </div>
      <div className="rb-fine" style={{ marginTop: 6 }}>{description}</div>
    </Link>
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
    <div className="rb-empty">
      <div className="rb-emptyTitle">
        <Icon name="spark" size={18} tone="accent" />
        <span>{title}</span>
      </div>
      <div className="rb-pageCopy">{description}</div>
      {action ? <div className="rb-inlineRow">{action}</div> : null}
    </div>
  );
}
