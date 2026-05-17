import Link from "next/link";
import React from "react";
import { controlTheme as t } from "@/components/control/controlTheme";

type Tone = "primary" | "secondary" | "ghost" | "danger";

function toneStyles(tone: Tone) {
  if (tone === "primary") return { background: t.color.purple, border: "rgba(124, 58, 237, 0.42)", color: t.color.text };
  if (tone === "secondary") return { background: "rgba(37, 99, 235, 0.18)", border: "rgba(37, 99, 235, 0.36)", color: t.color.text };
  if (tone === "danger") return { background: "rgba(239, 68, 68, 0.14)", border: "rgba(239, 68, 68, 0.30)", color: "#FECACA" };
  return { background: "rgba(148, 163, 184, 0.08)", border: t.color.softBorder, color: t.color.textSecondary };
}

const baseStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  minHeight: 38,
  padding: "0 14px",
  borderRadius: 12,
  borderWidth: 1,
  borderStyle: "solid",
  textDecoration: "none",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  transition: "transform 120ms ease, opacity 120ms ease, border-color 120ms ease",
  whiteSpace: "nowrap",
};

export function ControlActionLink({
  href,
  children,
  tone = "ghost",
}: {
  href: string;
  children: React.ReactNode;
  tone?: Tone;
}) {
  const styles = toneStyles(tone);
  return (
    <Link
      href={href}
      style={{
        ...baseStyle,
        background: styles.background,
        borderColor: styles.border,
        color: styles.color,
      }}
    >
      {children}
    </Link>
  );
}

export default function ControlActionButton({
  children,
  tone = "ghost",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: Tone;
}) {
  const styles = toneStyles(tone);
  return (
    <button
      {...props}
      style={{
        ...baseStyle,
        background: styles.background,
        borderColor: styles.border,
        color: styles.color,
        opacity: props.disabled ? 0.6 : 1,
        ...(props.style ?? {}),
      }}
    >
      {children}
    </button>
  );
}
