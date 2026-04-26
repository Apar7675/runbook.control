import Link from "next/link";
import React from "react";
import { controlV2Theme as t } from "@/components/control/v2/controlV2Theme";

function toneStyle(tone: "primary" | "secondary" | "danger" | "ghost"): React.CSSProperties {
  if (tone === "primary") {
    return {
      border: `1px solid ${t.color.accentBorder}`,
      background: t.color.accentSurface,
      color: t.color.text,
    };
  }
  if (tone === "danger") {
    return {
      border: `1px solid ${t.color.dangerBorder}`,
      background: t.color.dangerSurface,
      color: t.color.danger,
    };
  }
  if (tone === "ghost") {
    return {
      border: "1px solid transparent",
      background: "transparent",
      color: t.color.textMuted,
    };
  }
  return {
    border: `1px solid ${t.color.border}`,
    background: t.color.surfaceAlt,
    color: t.color.text,
  };
}

export function ControlActionButtonV2({
  children,
  tone = "secondary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "primary" | "secondary" | "danger" | "ghost";
}) {
  return (
    <button
      {...props}
      style={{
        minHeight: 30,
        padding: "5px 10px",
        borderRadius: t.radius.sm,
        fontSize: 12,
        fontWeight: 700,
        cursor: props.disabled ? "not-allowed" : "pointer",
        opacity: props.disabled ? 0.6 : 1,
        ...toneStyle(tone),
        ...(props.style ?? {}),
      }}
    >
      {children}
    </button>
  );
}

export function ControlActionLinkV2({
  href,
  children,
  tone = "secondary",
}: {
  href: string;
  children: React.ReactNode;
  tone?: "primary" | "secondary" | "danger" | "ghost";
}) {
  return (
    <Link
      href={href}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 30,
        padding: "5px 10px",
        borderRadius: t.radius.sm,
        fontSize: 12,
        fontWeight: 700,
        textDecoration: "none",
        ...toneStyle(tone),
      }}
    >
      {children}
    </Link>
  );
}
