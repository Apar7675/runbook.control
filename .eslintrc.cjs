module.exports = {
  root: true,
  extends: ["next/core-web-vitals", "next/typescript"],

  // Launch-safe: keep lint useful but not a blocker while you're still building.
  rules: {
    "@typescript-eslint/no-explicit-any": "warn",
    "react-hooks/exhaustive-deps": "warn",
  },

  overrides: [
    // API routes: allow any (normal for route handlers)
    {
      files: ["src/app/api/**/*.{ts,tsx}"],
      rules: {
        "@typescript-eslint/no-explicit-any": "off",
        "react-hooks/exhaustive-deps": "off",
      },
    },
  ],
};
