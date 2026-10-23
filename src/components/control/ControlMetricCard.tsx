import Link from "next/link";
import React from "react";
import { controlTheme as t } from "@/components/control/controlTheme";
import ControlStatusChip, { type ControlStatusTone } from "@/components/control/ControlStatusChip";

export default function ControlMetricCard({
  label,
  value,
  meta,
  tone = "neutral",
  href,
  compact = false,
}: {
  label: string;
  value: string;
  meta?: string;
  tone?: ControlStatusTone;
  href?: string;
  compact?: boolean;
}) {
  const statusLabel =
    tone === "danger" ? "Attention" :
    tone === "warning" ? "Watch" :
    tone === "success" ? "OK" :
    tone === "info" ? "Info" :
    "Info";

  const body = (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto",
        alignItems: "center",
        gap: 16,
        minHeight: compact ? 92 : 100,
        boxSizing: compact ? "border-box" : undefined,
        padding: "12px 14px",
        borderRadius: t.radius.md,
        border: `1.25px solid ${t.color.border}`,
        background: t.color.support,
      }}
    >
      <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
        <div style={{ color: t.color.textSecondary, fontSize: 16, fontWeight: 600 }}>{label}</div>
        {compact ? <div style={{ fontSize: 14, lineHeight: 1.35, color: t.color.textMuted }}>{meta}</div> : <div
          style={{
            fontSize: 14,
            lineHeight: 1.35,
            color: t.color.textMuted,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {meta ?? "No additional context yet."}
        </div>}
      </div>
      <div style={{ display: "grid", gap: 6, justifyItems: "end", minWidth: compact ? undefined : 76 }}>
        <div style={{ fontSize: compact ? 34 : 30, lineHeight: 1.05, fontWeight: 800, color: t.color.text, textAlign: "right" }}>{value}</div>
        {compact ? null : <ControlStatusChip label={statusLabel} tone={tone} />}
      </div>
    </div>
  );

  if (!href) return body;

  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      {body}
    </Link>
  );
}
