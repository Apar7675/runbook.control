import Link from "@/components/control/CompanyLink";
import React from "react";
import { controlTheme as t } from "@/components/control/controlTheme";

type Tone = "primary" | "secondary" | "ghost" | "danger";

function toneStyles(tone: Tone) {
  if (tone === "primary") return { background: t.color.blue, border: t.color.blue, color: "#FFFFFF" };
  if (tone === "secondary") return { background: "#FFFFFF", border: "#8BAAFF", color: t.color.blue };
  if (tone === "danger") return { background: "#FFF0F3", border: "#EDB5C1", color: t.color.danger };
  return { background: "#FFFFFF", border: "#A0B8FF", color: t.color.blue };
}

const baseStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  minHeight: 34,
  padding: "0 11px",
  borderRadius: 7,
  borderWidth: 1,
  borderStyle: "solid",
  textDecoration: "none",
  fontSize: 14,
  fontWeight: 600,
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
