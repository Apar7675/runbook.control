import React from "react";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: "relative",
        minHeight: "100vh",
        overflow: "hidden",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(5, 10, 20, 0.6), rgba(5, 10, 20, 0.9)), radial-gradient(circle at 50% 35%, rgba(120, 160, 255, 0.18) 0%, rgba(40, 80, 160, 0.12) 25%, rgba(10, 20, 40, 0.6) 55%, rgba(5, 10, 20, 0.95) 100%), url('/images/chatgpt_space_bg.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          backgroundAttachment: "fixed",
          zIndex: 0,
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          minHeight: "100vh",
          padding: "28px 24px 36px",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div style={{ width: "100%", maxWidth: 1120 }}>{children}</div>
      </div>
    </div>
  );
}
