export const controlTheme = {
  color: {
    appBg: "#070A0F",
    surface: "#0B1018",
    elevated: "#101722",
    card: "#121B28",
    border: "#243247",
    softBorder: "rgba(148, 163, 184, 0.16)",
    purple: "#7C3AED",
    blue: "#2563EB",
    cyan: "#06B6D4",
    success: "#22C55E",
    warning: "#F59E0B",
    danger: "#EF4444",
    text: "#F8FAFC",
    textSecondary: "#CBD5E1",
    textMuted: "#64748B",
    overlay: "rgba(7, 10, 15, 0.78)",
  },
  radius: {
    sm: 10,
    md: 14,
    lg: 18,
    xl: 22,
    pill: 999,
  },
  shadow: {
    panel: "0 18px 40px rgba(0, 0, 0, 0.24)",
  },
  layout: {
    sidebarWidth: 272,
    contentMaxWidth: 1600,
  },
} as const;
