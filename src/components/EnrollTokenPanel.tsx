"use client";

import React from "react";
import Link from "next/link";
import GlassCard from "@/components/GlassCard";

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "5px 10px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.16)",
        background: "rgba(139,140,255,0.16)",
        color: "#b8b9ff",
        fontWeight: 900,
        fontSize: 12,
        letterSpacing: 0.4,
        textTransform: "uppercase",
      }}
    >
      {children}
    </span>
  );
}

export default function EnrollTokenPanel({ shopId }: { shopId: string }) {
  const [ttl, setTtl] = React.useState<number>(120);
  const [loading, setLoading] = React.useState(false);
  const [token, setToken] = React.useState<string>("");
  const [expiresAt, setExpiresAt] = React.useState<string>("");
  const [status, setStatus] = React.useState<string>("");

  async function generate() {
    try {
      setLoading(true);
      setStatus("");
      setToken("");
      setExpiresAt("");

      const res = await fetch("/api/device/enroll-token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ shop_id: shopId, ttl_minutes: ttl }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        const msg = data?.error ? String(data.error) : `HTTP ${res.status}`;
        setStatus(`❌ Failed: ${msg}`);
        return;
      }

      setToken(String(data.token ?? ""));
      setExpiresAt(String(data.expires_at ?? ""));
      setStatus("✅ Token generated. Copy it into RunBook Desktop → Control tab.");
    } catch (e: any) {
      setStatus("❌ Error: " + (e?.message ?? "unknown"));
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    try {
      if (!token) return;
      await navigator.clipboard.writeText(token);
      setStatus("✅ Token copied.");
    } catch {
      setStatus("❌ Copy failed (clipboard blocked).");
    }
  }

  return (
    <GlassCard title="Desktop Enrollment (platform admin)">
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <Pill>ONE-TIME TOKEN</Pill>
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            Generate a token, then paste into <b>RunBook Desktop → Control</b> to enroll this PC.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>TTL</div>
          <select
            value={ttl}
            onChange={(e) => setTtl(Number(e.target.value))}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(255,255,255,0.03)",
              color: "#e6e8ef",
              fontWeight: 900,
              outline: "none",
            }}
          >
            <option value={15}>15 minutes</option>
            <option value={60}>60 minutes</option>
            <option value={120}>120 minutes</option>
            <option value={240}>240 minutes</option>
          </select>

          <button
            onClick={generate}
            disabled={loading}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.10)",
              background: loading ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.04)",
              color: "#e6e8ef",
              fontWeight: 900,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Generating…" : "Generate Token"}
          </button>

          <button
            onClick={copy}
            disabled={!token}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.10)",
              background: token ? "rgba(139,140,255,0.16)" : "rgba(255,255,255,0.02)",
              color: token ? "#b8b9ff" : "rgba(230,232,239,0.5)",
              fontWeight: 900,
              cursor: token ? "pointer" : "not-allowed",
            }}
          >
            Copy Token
          </button>
        </div>

        {token ? (
          <div
            style={{
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(0,0,0,0.25)",
              borderRadius: 12,
              padding: 12,
              fontFamily:
                "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
              fontSize: 12,
              color: "#e6e8ef",
              wordBreak: "break-all",
            }}
          >
            {token}
          </div>
        ) : null}

        {expiresAt ? (
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            Expires: <b>{expiresAt}</b>
          </div>
        ) : null}

        {status ? <div style={{ fontSize: 12, opacity: 0.9 }}>{status}</div> : null}

        <div style={{ fontSize: 12, opacity: 0.7 }}>
          After enrollment, the device will appear in{" "}
          <Link href={`/shops/${shopId}/devices`} style={{ color: "#b8b9ff", textDecoration: "none", fontWeight: 900 }}>
            Manage Devices →
          </Link>
        </div>
      </div>
    </GlassCard>
  );
}
