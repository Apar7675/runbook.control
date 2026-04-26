export const theme = {
  bg: {
    app: "#040812",
    shell: "linear-gradient(180deg, rgba(11,17,29,0.98), rgba(7,10,18,0.99))",
    shellElevated:
      "linear-gradient(180deg, rgba(16,23,39,0.96), rgba(9,13,23,0.98))",
    panel:
      "linear-gradient(180deg, rgba(19,28,47,0.90), rgba(10,15,27,0.95))",
    panelRaised:
      "linear-gradient(180deg, rgba(24,35,58,0.96), rgba(12,18,31,0.96))",
    panelSoft:
      "linear-gradient(180deg, rgba(17,25,42,0.82), rgba(10,15,26,0.84))",
    panelInset:
      "linear-gradient(180deg, rgba(9,14,25,0.96), rgba(7,11,19,0.98))",
    panelHealthy:
      "linear-gradient(180deg, rgba(18,39,38,0.90), rgba(10,17,24,0.96))",
    panelWarning:
      "linear-gradient(180deg, rgba(49,37,19,0.90), rgba(17,14,20,0.96))",
    panelCritical:
      "linear-gradient(180deg, rgba(62,24,31,0.92), rgba(18,11,19,0.97))",
    nav: "linear-gradient(180deg, rgba(15,22,37,0.96), rgba(8,12,22,0.98))",
    navSection:
      "linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.015))",
    navActive:
      "linear-gradient(135deg, rgba(91,110,255,0.24), rgba(73,160,255,0.16) 58%, rgba(189,128,255,0.14))",
    navIdle: "rgba(255,255,255,0.025)",
    header:
      "linear-gradient(180deg, rgba(9,14,24,0.94), rgba(7,11,19,0.88))",
    headerGlass:
      "linear-gradient(180deg, rgba(15,22,37,0.86), rgba(8,12,20,0.72))",
    appGlow:
      "radial-gradient(circle at top left, rgba(84,118,255,0.19), transparent 26%), radial-gradient(circle at 52% 10%, rgba(72,156,255,0.11), transparent 24%), radial-gradient(circle at top right, rgba(163,102,255,0.10), transparent 22%), radial-gradient(circle at 50% 32%, rgba(115,153,214,0.09), transparent 30%), #040812",
  },

  border: {
    soft: "1px solid rgba(255,255,255,0.10)",
    muted: "1px solid rgba(255,255,255,0.06)",
    strong: "1px solid rgba(255,255,255,0.16)",
    healthy: "1px solid rgba(86, 220, 154, 0.20)",
    warning: "1px solid rgba(226, 174, 88, 0.24)",
    critical: "1px solid rgba(222, 118, 118, 0.25)",
    accent: "1px solid rgba(122, 157, 214, 0.30)",
    accentSoft: "1px solid rgba(122, 157, 214, 0.16)",
    accentStrong: "1px solid rgba(150, 176, 255, 0.32)",
    nav: "1px solid rgba(126, 171, 217, 0.14)",
    glow: "1px solid rgba(110, 149, 255, 0.24)",
  },

  text: {
    primary: "#eef4ff",
    secondary: "rgba(238,244,255,0.82)",
    muted: "rgba(186,198,221,0.88)",
    quiet: "rgba(132,147,176,0.92)",
    accent: "#7eabd9",
    accentSoft: "#dce7ff",
    danger: "#ff8d8d",
    gold: "#ffe2b2",
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
    shell: "0 28px 80px rgba(0,0,0,0.34)",
    panel: "0 10px 24px rgba(0,0,0,0.18)",
    raised: "0 12px 28px rgba(0,0,0,0.20)",
    healthy: "0 10px 22px rgba(14, 45, 34, 0.10)",
    warning: "0 10px 24px rgba(72, 42, 8, 0.11)",
    critical: "0 10px 26px rgba(74, 10, 14, 0.12)",
    hero: "0 26px 68px rgba(0,0,0,0.38)",
    glowSoft:
      "0 0 0 1px rgba(123,157,214,0.05), 0 10px 22px rgba(0,0,0,0.16)",
    nav: "none",
    button: "0 8px 18px rgba(8,15,30,0.18)",
  },
} as const;
