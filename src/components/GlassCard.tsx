import React from "react";

type Tone = "default" | "subtle" | "healthy" | "warning" | "critical" | "danger";

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
  const toneClass =
    tone === "subtle"
      ? "rb-panel rb-panel--subtle"
      : tone === "healthy"
      ? "rb-panel rb-panel--healthy"
      : tone === "warning"
      ? "rb-panel rb-panel--warning"
      : tone === "critical"
      ? "rb-panel rb-panel--critical"
      : tone === "danger"
      ? "rb-panel rb-panel--danger"
      : "rb-panel";

  return (
    <section className={toneClass}>
      <div className="rb-panel__inner">
        {(title || subtitle || actions) && (
          <div className="rb-panel__header">
            <div className="rb-panel__headerMain">
              {title ? <div className="rb-panel__eyebrow">{title}</div> : null}
              {subtitle ? <div className="rb-panel__copy">{subtitle}</div> : null}
            </div>
            {actions ? <div className="rb-inlineRow">{actions}</div> : null}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}
