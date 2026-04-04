import React from "react";
import { theme } from "@/lib/ui/theme";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          background: theme.bg.appGlow,
          color: "#e6e8ef",
          fontFamily: "\"Segoe UI\", \"Helvetica Neue\", Arial, sans-serif",
        }}
      >
        {children}
      </body>
    </html>
  );
}
