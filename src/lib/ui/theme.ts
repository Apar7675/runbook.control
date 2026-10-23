export const theme = {
  bg: {
    app: "#eef2ff",
    shell: "linear-gradient(180deg, #ffffff, #f4f7ff)",
    shellElevated:
      "linear-gradient(180deg, #ffffff, #eef2ff)",
    panel:
      "#ffffff",
    panelRaised:
      "#ffffff",
    panelSoft:
      "#f5f7ff",
    panelInset:
      "#ffffff",
    panelHealthy:
      "#f0fbf6",
    panelWarning:
      "#fff8eb",
    panelCritical:
      "#fff3f3",
    nav: "linear-gradient(180deg, #0d1b35, #08162c)",
    navSection:
      "linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.015))",
    navActive:
      "linear-gradient(135deg, #087bff, #0755ff)",
    navIdle: "rgba(255,255,255,0.025)",
    header:
      "#ffffff",
    headerGlass:
      "rgba(255,255,255,0.94)",
    appGlow:
      "radial-gradient(circle at top right, rgba(193,200,255,0.28), transparent 36%), linear-gradient(135deg, #f3f7ff, #eeefff)",
  },

  border: {
    soft: "1px solid #dce5ff",
    muted: "1px solid #e6ecff",
    strong: "1px solid #c4d3ff",
    healthy: "1px solid #bfe9da",
    warning: "1px solid #f4deb4",
    critical: "1px solid #f4c9cb",
    accent: "1px solid #8faeff",
    accentSoft: "1px solid #c8d6ff",
    accentStrong: "1px solid #0755ff",
    nav: "1px solid rgba(126, 171, 217, 0.14)",
    glow: "1px solid rgba(110, 149, 255, 0.24)",
  },

  text: {
    primary: "#07154f",
    secondary: "#263d79",
    muted: "#52699a",
    quiet: "#586d99",
    accent: "#0755ff",
    accentSoft: "#0755ff",
    danger: "#bb2b37",
    gold: "#a65a00",
  },

  radius: {
    sm: 8,
    md: 11,
    lg: 14,
    xl: 18,
    xxl: 24,
    pill: 999,
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 14,
    xl: 18,
    xxl: 24,
    shellX: 16,
    shellY: 14,
    contentWidth: 1600,
    navWidth: 240,
  },

  type: {
    family:
      "\"Aptos\", \"Segoe UI Variable\", \"Segoe UI\", \"Helvetica Neue\", Arial, sans-serif",
    display: {
      fontSize: 29,
      fontWeight: 800,
      lineHeight: 1.02,
      letterSpacing: -0.7,
    },
    h2: {
      fontSize: 19,
      fontWeight: 800,
      lineHeight: 1.08,
      letterSpacing: -0.34,
    },
    title: {
      fontSize: 13.5,
      fontWeight: 800,
      lineHeight: 1.2,
      letterSpacing: -0.12,
    },
    body: {
      fontSize: 12.5,
      lineHeight: 1.48,
    },
    label: {
      fontSize: 10,
      fontWeight: 900,
      letterSpacing: 0.72,
      textTransform: "uppercase" as const,
    },
  },

  shadow: {
    shell: "0 20px 60px rgba(36,66,132,0.08)",
    panel: "0 4px 16px rgba(36,66,132,0.04)",
    raised: "0 5px 18px rgba(36,66,132,0.06)",
    healthy: "0 10px 22px rgba(14, 45, 34, 0.10)",
    warning: "0 10px 24px rgba(72, 42, 8, 0.11)",
    critical: "0 10px 26px rgba(74, 10, 14, 0.12)",
    hero: "0 20px 50px rgba(36,66,132,0.10)",
    glowSoft:
      "0 0 0 1px rgba(123,157,214,0.06), 0 4px 14px rgba(36,66,132,0.05)",
    nav: "none",
    button: "0 2px 5px rgba(36,66,132,0.05)",
  },
} as const;
