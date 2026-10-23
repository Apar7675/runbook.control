import React from "react";
import { controlTheme as t } from "@/components/control/controlTheme";

export type ControlStatusTone = "neutral" | "info" | "success" | "warning" | "danger";

function toneStyles(tone: ControlStatusTone) {
  if (tone === "success") return { color: t.color.success, border: "#C9EDDD", background: "#E2F7EE" };
  if (tone === "warning") return { color: t.color.warning, border: "#F8E5BF", background: "#FFF3DD" };
  if (tone === "danger") return { color: t.color.danger, border: "#F3CDDA", background: "#FFF0F3" };
  if (tone === "info") return { color: t.color.cyan, border: "#CAE4F5", background: "#E9F5FC" };
  return { color: t.color.textSecondary, border: t.color.softBorder, background: "#EEF2FF" };
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
        gap: 6,
        minHeight: 30,
        padding: "3px 11px",
        borderRadius: t.radius.pill,
        border: `1px solid ${styles.border}`,
        background: styles.background,
        color: styles.color,
        fontSize: 14,
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: styles.color,
          boxShadow: `0 0 0 3px ${styles.background}`,
        }}
      />
      {label}
    </span>
  );
}
