import React from "react";
import { controlV2Theme as t } from "@/components/control/v2/controlV2Theme";

export function toneFromStatusV2(status: string) {
  const normalized = String(status ?? "").trim().toLowerCase();
  if (["healthy", "active", "full access", "full", "ready", "connected", "ok"].includes(normalized)) return "success";
  if (["warning", "pending", "read-only", "queue-only", "degraded"].includes(normalized)) return "warning";
  if (["blocked", "restricted", "offline", "action needed", "failed", "critical"].includes(normalized)) return "danger";
  return "neutral";
}

function palette(tone: "success" | "warning" | "danger" | "neutral") {
  if (tone === "success") return { bg: t.color.successSurface, border: t.color.successBorder, text: t.color.success };
  if (tone === "warning") return { bg: t.color.warningSurface, border: t.color.warningBorder, text: t.color.warning };
  if (tone === "danger") return { bg: t.color.dangerSurface, border: t.color.dangerBorder, text: t.color.danger };
  return { bg: "rgba(255,255,255,0.04)", border: t.color.borderStrong, text: t.color.textMuted };
}

export default function ControlBadgeV2({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "success" | "warning" | "danger" | "neutral";
}) {
  const colors = palette(tone);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        minHeight: 22,
        padding: "3px 8px",
        borderRadius: t.radius.pill,
        border: `1px solid ${colors.border}`,
        background: colors.bg,
        color: colors.text,
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: 0.4,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: t.radius.pill, background: colors.text }} />
      {label}
    </span>
  );
}
