import React from "react";
import { theme } from "@/lib/ui/theme";

export default function GlassCard({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        padding: 18,
        borderRadius: theme.radius.lg,
        border: theme.border.soft,
        background: theme.bg.panel,
        backdropFilter: "blur(10px)",
        boxShadow: theme.shadow.panel,
        color: theme.text.primary,
      }}
    >
      {title && (
        <div
          style={{
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: 0.6,
            color: theme.text.accent,
            marginBottom: 12,
            textTransform: "uppercase",
          }}
        >
          {title}
        </div>
      )}

      {children}
    </div>
  );
}
