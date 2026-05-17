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
  const body = (
    <div
      style={{
        display: "grid",
        gap: 12,
        minHeight: 132,
        padding: 16,
        borderRadius: t.radius.lg,
        border: `1px solid ${t.color.softBorder}`,
        background: `linear-gradient(180deg, rgba(16, 23, 34, 0.98), rgba(11, 16, 24, 0.98))`,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
        <div style={{ color: t.color.textSecondary, fontSize: 12, fontWeight: 700, letterSpacing: 0.24 }}>{label}</div>
        <ControlStatusChip label={tone === "danger" ? "Attention" : tone === "warning" ? "Watch" : tone === "success" ? "Healthy" : "Live"} tone={tone} />
      </div>
      <div style={{ display: "grid", gap: 6, alignSelf: "end" }}>
        <div style={{ fontSize: 34, lineHeight: 1, fontWeight: 800, color: t.color.text }}>{value}</div>
        <div style={{ fontSize: 13, color: t.color.textMuted }}>{meta ?? "No additional context yet."}</div>
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
