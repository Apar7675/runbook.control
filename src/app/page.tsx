import Image from "next/image";
import Link from "next/link";

export const dynamic = "force-static";

export default function HomePage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(1200px 600px at 20% -10%, #1b1f4a, #05070f)",
        padding: 24,
        textAlign: "center",
      }}
    >
      <div style={{ maxWidth: 900, width: "100%" }}>
        <Image
          src="/runbook-splash.png"
          alt="RunBook"
          width={900}
          height={450}
          style={{
            width: "100%",
            height: "auto",
            borderRadius: 24,
            boxShadow: "0 20px 80px rgba(0,0,0,0.6)",
          }}
          priority
        />
      </div>

      <h1 style={{ marginTop: 40, fontSize: 36, fontWeight: 900 }}>
        Manufacturing Control, Reimagined
      </h1>

      <p style={{ marginTop: 12, maxWidth: 600, opacity: 0.8 }}>
        RunBook centralizes shop operations, device control, updates, and compliance
        into one powerful platform.
      </p>

      <div style={{ marginTop: 32, display: "flex", gap: 20 }}>
        <Link
          href="/signup"
          style={{
            padding: "14px 24px",
            borderRadius: 14,
            fontWeight: 900,
            background: "linear-gradient(90deg,#7b5cff,#4dd0ff)",
            color: "white",
            textDecoration: "none",
            boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
          }}
        >
          Start 30-Day Free Trial
        </Link>

        <Link
          href="/login"
          style={{
            padding: "14px 24px",
            borderRadius: 14,
            fontWeight: 900,
            border: "1px solid rgba(255,255,255,0.2)",
            color: "#e6e8ef",
            textDecoration: "none",
          }}
        >
          Login
        </Link>
      </div>
    </div>
  );
}
