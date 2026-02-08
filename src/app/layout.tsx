import React from "react";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          background: "radial-gradient(1200px 600px at 20% -10%, #1b1f4a, #05070f)",
          color: "#e6e8ef",
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont",
        }}
      >
        {children}
      </body>
    </html>
  );
}
