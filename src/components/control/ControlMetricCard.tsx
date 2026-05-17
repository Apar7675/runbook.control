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
}: {
  label: string;
  value: string;
  meta?: string;
  tone?: ControlStatusTone;
  href?: string;
}) {
  const statusLabel =
    tone === "danger" ? "Attention" :
    tone === "warning" ? "Watch" :
    tone === "success" ? "OK" :
    tone === "info" ? "Info" :
    "Live";

  const body = (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto",
        alignItems: "center",
        gap: 12,
        minHeight: 78,
        padding: "11px 12px",
        borderRadius: t.radius.md,
        border: `1px solid ${t.color.softBorder}`,
        background: `linear-gradient(180deg, rgba(16, 23, 34, 0.98), rgba(11, 16, 24, 0.98))`,
      }}
    >
      <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
        <div style={{ color: t.color.textSecondary, fontSize: 12, fontWeight: 800 }}>{label}</div>
        <div
          style={{
            fontSize: 12,
            lineHeight: 1.35,
            color: t.color.textMuted,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {meta ?? "No additional context yet."}
        </div>
      </div>
      <div style={{ display: "grid", gap: 6, justifyItems: "end", minWidth: 76 }}>
        <div style={{ fontSize: 22, lineHeight: 1.05, fontWeight: 800, color: t.color.text, textAlign: "right" }}>{value}</div>
        <ControlStatusChip label={statusLabel} tone={tone} />
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
