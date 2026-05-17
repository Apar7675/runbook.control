import React from "react";
import { controlTheme as t } from "@/components/control/controlTheme";

export type ControlStatusTone = "neutral" | "info" | "success" | "warning" | "danger";

function toneStyles(tone: ControlStatusTone) {
  if (tone === "success") return { color: t.color.success, border: "rgba(34, 197, 94, 0.28)", background: "rgba(34, 197, 94, 0.10)" };
  if (tone === "warning") return { color: t.color.warning, border: "rgba(245, 158, 11, 0.28)", background: "rgba(245, 158, 11, 0.10)" };
  if (tone === "danger") return { color: t.color.danger, border: "rgba(239, 68, 68, 0.28)", background: "rgba(239, 68, 68, 0.10)" };
  if (tone === "info") return { color: t.color.cyan, border: "rgba(6, 182, 212, 0.28)", background: "rgba(6, 182, 212, 0.10)" };
  return { color: t.color.textSecondary, border: t.color.softBorder, background: "rgba(148, 163, 184, 0.08)" };
}

export default function ControlStatusChip({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: ControlStatusTone;
}) {
  const styles = toneStyles(tone);

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        minHeight: 28,
        padding: "0 10px",
        borderRadius: t.radius.pill,
        border: `1px solid ${styles.border}`,
        background: styles.background,
        color: styles.color,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: 0.2,
        whiteSpace: "nowrap",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: styles.color,
          boxShadow: `0 0 0 4px ${styles.background}`,
        }}
      />
      {label}
    </span>
  );
}
