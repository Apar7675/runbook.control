"use client";

import Link from "next/link";
import React, { useState } from "react";
import { runbookTheme } from "@/lib/ui/runbookTheme";

type CardTone = "default" | "success" | "warning" | "danger";
type ButtonTone = "primary" | "ghost";

function toneStyles(tone: CardTone) {
  if (tone === "success") {
    return {
      border: runbookTheme.border.success,
      background: "linear-gradient(180deg, rgba(16,35,28,0.70), rgba(9,16,27,0.72))",
      stripe: "linear-gradient(180deg, rgba(86,199,140,0.98), rgba(63,155,108,0.96))",
      glow: "0 0 6px rgba(86,199,140,0.06)",
      dot: runbookTheme.colors.success,
      text: "#CDE5D8",
    };
  }
  if (tone === "warning") {
    return {
      border: runbookTheme.border.warning,
      background: "linear-gradient(180deg, rgba(53,40,20,0.86), rgba(15,20,30,0.84))",
      stripe: "linear-gradient(180deg, rgba(226,174,88,0.98), rgba(177,128,50,0.96))",
      glow: "0 0 10px rgba(226,174,88,0.09)",
      dot: runbookTheme.colors.warning,
      text: "#F6E5C0",
    };
  }
  if (tone === "danger") {
    return {
      border: runbookTheme.border.danger,
      background: "linear-gradient(180deg, rgba(60,30,30,0.86), rgba(18,16,24,0.86))",
      stripe: "linear-gradient(180deg, rgba(222,118,118,0.98), rgba(168,87,87,0.96))",
      glow: "0 0 10px rgba(222,118,118,0.10)",
      dot: runbookTheme.colors.danger,
      text: "#F5D7D7",
    };
  }
  return {
    border: runbookTheme.border.panel,
    background: runbookTheme.gradients.panel,
    stripe: "linear-gradient(180deg, rgba(126,171,217,0.92), rgba(94,132,198,0.88))",
    glow: runbookTheme.shadow.focusSoft,
    dot: runbookTheme.colors.info,
    text: runbookTheme.colors.text,
  };
}

export function RunbookContainer({
  children,
  maxWidth = 760,
}: {
  children: React.ReactNode;
  maxWidth?: number;
}) {
  return (
    <div
      style={{
        maxWidth,
        width: "100%",
        display: "grid",
        gap: runbookTheme.spacing.section,
        padding: `${runbookTheme.spacing.shellTop}px ${runbookTheme.spacing.shellX}px ${runbookTheme.spacing.shellBottom}px`,
        background: "transparent",
      }}
    >
      {children}
    </div>
  );
}

export function RunbookSectionHeader({
  title,
  subtitle,
  eyebrow,
  actions,
}: {
  title: string;
  subtitle?: React.ReactNode;
  eyebrow?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
      <div style={{ display: "grid", gap: 6 }}>
        {eyebrow ? (
          <div
            style={{
              color: runbookTheme.colors.info,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 0.8,
              textTransform: "uppercase",
            }}
          >
            {eyebrow}
          </div>
        ) : null}
        <h1
          style={{
            margin: 0,
            color: runbookTheme.colors.text,
            ...runbookTheme.type.dialogTitle,
          }}
        >
          {title}
        </h1>
        {subtitle ? (
          <div
            style={{
              marginTop: 0,
              color: runbookTheme.colors.muted2,
              maxWidth: 620,
              ...runbookTheme.type.dialogSubtitle,
            }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>
      {actions ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>{actions}</div> : null}
    </div>
  );
}

export function RunbookCard({
  title,
  subtitle,
  tone = "default",
  children,
  actions,
  leading,
  compressed = false,
  emphasized = false,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  tone?: CardTone;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  leading?: React.ReactNode;
  compressed?: boolean;
  emphasized?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const palette = toneStyles(tone);
  const activeShadow = emphasized ? `${runbookTheme.shadow.floating}, 0 0 14px rgba(110,157,218,0.12)` : `${runbookTheme.shadow.floating}, ${palette.glow}`;
  const restingShadow = compressed ? "0 7px 16px rgba(0,0,0,0.14)" : runbookTheme.shadow.floating;
  const borderColor = emphasized
    ? tone === "warning"
      ? "1px solid rgba(226,174,88,0.46)"
      : tone === "danger"
      ? "1px solid rgba(222,118,118,0.46)"
      : "1px solid rgba(126,171,217,0.48)"
    : palette.border;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: runbookTheme.radius.panel,
        border: borderColor,
        background: palette.background,
        boxShadow: hovered ? activeShadow : restingShadow,
        transform: hovered ? "translateY(-1px)" : "translateY(0)",
        transition: `transform ${runbookTheme.motion.smooth}, box-shadow ${runbookTheme.motion.hover}, border-color ${runbookTheme.motion.hover}`,
        opacity: compressed ? 0.92 : 1,
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 10,
          bottom: 10,
          left: 0,
          width: 3,
          borderRadius: 3,
          background: palette.stripe,
        }}
      />
      <div
        style={{
          padding: `${compressed ? 8 : runbookTheme.spacing.card}px ${runbookTheme.spacing.section}px`,
          display: "grid",
          gap: compressed ? 8 : 10,
        }}
      >
        {(title || subtitle || actions) && (
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ display: "grid", gap: 3 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                {leading}
                {title ? (
                  <div style={{ color: palette.text, opacity: compressed ? 0.92 : 1, ...runbookTheme.type.sectionTitle }}>
                    {title}
                  </div>
                ) : null}
              </div>
              {subtitle ? (
                <div style={{ color: runbookTheme.colors.muted2, opacity: compressed ? 0.88 : 1, ...runbookTheme.type.sectionSub }}>
                  {subtitle}
                </div>
              ) : null}
            </div>
            {actions ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{actions}</div> : null}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

type RunbookButtonProps = {
  children: React.ReactNode;
  tone?: ButtonTone;
  href?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  style?: React.CSSProperties;
  title?: string;
};

const baseButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 36,
  padding: "12px 14px",
  borderRadius: runbookTheme.radius.button,
  textDecoration: "none",
  fontSize: 12,
  fontWeight: 700,
  lineHeight: 1,
  transition: `transform ${runbookTheme.motion.smooth}, box-shadow ${runbookTheme.motion.hover}, border-color ${runbookTheme.motion.hover}, opacity ${runbookTheme.motion.smooth}`,
  cursor: "pointer",
};

function buttonToneStyle(tone: ButtonTone, disabled?: boolean): React.CSSProperties {
  if (tone === "primary") {
    return {
      color: "#F5F8FD",
      background: disabled ? "linear-gradient(180deg, rgba(50,66,96,0.9), rgba(33,46,71,0.92))" : runbookTheme.gradients.buttonPrimary,
      border: disabled ? "1px solid rgba(112,138,185,0.20)" : runbookTheme.border.primaryButton,
      boxShadow: disabled ? "0 8px 16px rgba(0,0,0,0.14)" : runbookTheme.shadow.primary,
      opacity: disabled ? 0.82 : 1,
    };
  }

  return {
    color: runbookTheme.colors.text,
    background: disabled ? "linear-gradient(180deg, rgba(25,34,49,0.9), rgba(18,26,40,0.9))" : runbookTheme.gradients.buttonGhost,
    border: disabled ? "1px solid rgba(71,99,134,0.34)" : runbookTheme.border.ghostButton,
    boxShadow: disabled ? "0 6px 12px rgba(0,0,0,0.12)" : runbookTheme.shadow.button,
    opacity: disabled ? 0.78 : 1,
  };
}

export function RunbookButton({
  children,
  tone = "ghost",
  href,
  onClick,
  disabled,
  style,
  title,
}: RunbookButtonProps) {
  const [hovered, setHovered] = useState(false);
  const composedStyle = {
    ...baseButtonStyle,
    ...buttonToneStyle(tone, disabled),
    transform: hovered && !disabled ? "translateY(-1px)" : "translateY(0)",
    boxShadow:
      hovered && !disabled
        ? tone === "primary"
          ? "0 12px 22px rgba(44,72,128,0.34)"
          : "0 10px 18px rgba(0,0,0,0.22), 0 0 10px rgba(110,157,218,0.09)"
        : buttonToneStyle(tone, disabled).boxShadow,
    ...style,
  };

  if (href) {
    return (
      <Link
        href={href}
        title={title}
        style={composedStyle}
        aria-disabled={disabled}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {children}
      </Link>
    );
  }

  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={composedStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </button>
  );
}

export function RunbookStatusIndicator({
  status,
  label,
  tone,
}: {
  status: "complete" | "incomplete";
  label: string;
  tone?: "success" | "warning" | "danger";
}) {
  const complete = status === "complete";
  const resolvedTone = complete ? "success" : tone ?? "danger";
  const color =
    resolvedTone === "warning"
      ? runbookTheme.colors.warning
      : resolvedTone === "danger"
      ? runbookTheme.colors.danger
      : runbookTheme.colors.success;
  const border =
    resolvedTone === "warning"
      ? runbookTheme.border.warning
      : resolvedTone === "danger"
      ? runbookTheme.border.danger
      : runbookTheme.border.success;
  const background = complete
    ? "rgba(26,67,48,0.86)"
    : resolvedTone === "warning"
    ? "rgba(68,53,29,0.86)"
    : "rgba(74,41,41,0.84)";
  const dotGlow = complete
    ? "0 0 10px rgba(86,199,140,0.26)"
    : resolvedTone === "warning"
    ? "0 0 10px rgba(226,174,88,0.24)"
    : "0 0 10px rgba(222,118,118,0.24)";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "5px 12px",
        borderRadius: runbookTheme.radius.pill,
        background,
        border,
        color: color,
        boxShadow: runbookTheme.shadow.floating,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 0.5,
        textTransform: "uppercase",
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: 999,
          background: color,
          boxShadow: dotGlow,
        }}
      />
      {label}
    </span>
  );
}
