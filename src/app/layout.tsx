import React from "react";

export const metadata = {
  title: "RunBook Control",
  description: "RunBook Control Admin Console",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" style={{ height: "100%", background: "#05070f" }}>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          height: "100%",
          backgroundColor: "#05070f",
          backgroundImage:
            "radial-gradient(1200px 600px at 20% -10%, #1a1f3a 0%, #0b0f1f 35%, #05070f 100%)",
          backgroundRepeat: "no-repeat",
          backgroundAttachment: "fixed",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, system-ui, sans-serif',
        }}
      >
        {/* Global readability defaults */}
        <style>{`
          :root { color-scheme: dark; }
          * { box-sizing: border-box; }
          html, body { height: 100%; }
          body { color: #e6e8ef; }
          a { color: #8b8cff; }
          a:visited { color: #8b8cff; }
          h1,h2,h3,h4,h5,h6 { color: #eef0f7; }
          p,div,span,label { color: inherit; }

          input, textarea, select, button {
            color: #e6e8ef;
            background: rgba(255,255,255,0.06);
            border: 1px solid rgba(255,255,255,0.18);
          }

          ::placeholder { color: rgba(230,232,239,0.55); }

          /* Prevent “mystery black text” inside cards */
          [data-card], .card {
            color: #e6e8ef;
          }
        `}</style>

        {children}
      </body>
    </html>
  );
}
