"use client";

import React from "react";
import { controlV2Theme as t } from "@/components/control/v2/controlV2Theme";

export default function HeaderSearch() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "16px minmax(0, 1fr)",
        alignItems: "center",
        gap: 8,
        minWidth: 280,
        maxWidth: 420,
        minHeight: 34,
        padding: "0 10px",
        borderRadius: t.radius.sm,
        border: `1px solid ${t.color.border}`,
        background: t.color.surfaceMuted,
      }}
      aria-label="Global search"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke={t.color.textQuiet}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="11" cy="11" r="6.5" />
        <path d="m20 20-4.2-4.2" />
      </svg>
      <input
        type="text"
        aria-label="Search Control"
        placeholder="Search control"
        style={{
          width: "100%",
          background: "transparent",
          border: 0,
          outline: "none",
          color: t.color.text,
          fontSize: 12.5,
        }}
      />
    </div>
  );
}
