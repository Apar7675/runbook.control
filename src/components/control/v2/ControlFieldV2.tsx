import React from "react";
import { controlV2Theme as t } from "@/components/control/v2/controlV2Theme";

const fieldStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 32,
  borderRadius: t.radius.sm,
  border: `1px solid ${t.color.border}`,
  background: t.color.surfaceMuted,
  color: t.color.text,
  padding: "6px 10px",
  fontSize: 12.5,
  outline: "none",
};

export function ControlInputV2(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ ...fieldStyle, ...(props.style ?? {}) }} />;
}

export function ControlSelectV2(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} style={{ ...fieldStyle, ...(props.style ?? {}) }} />;
}
