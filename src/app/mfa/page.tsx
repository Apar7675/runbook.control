// REPLACE ENTIRE FILE: src/app/mfa/page.tsx

"use client";

import React, { useEffect, useState } from "react";
import GlassCard from "@/components/GlassCard";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function MFAPage() {
  const supabase = supabaseBrowser();

  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("Loading…");
  const [loading, setLoading] = useState(false);
  const [trustThisDevice, setTrustThisDevice] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setStatus("Loading MFA factors…");

      // ensure device id cookie exists (for trust)
      await fetch("/api/user/ensure-device-id", { method: "POST", credentials: "include" }).catch(() => {});

      const { data, error } = await supabase.auth.mfa.listFactors();
      if (cancelled) return;

      if (error) {
        setStatus(error.message);
        return;
      }

      const totp = (data?.totp ?? [])[0];
      if (!totp?.id) {
        setStatus("No authenticator is enabled for this account. Go to Settings and enable it first.");
        return;
      }

      setFactorId(totp.id);
      setStatus("Enter the 6-digit code from your authenticator app.");
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function verify() {
    if (!factorId) return;

    const otp = code.trim();
    if (otp.length !== 6) {
      setStatus("Enter a valid 6-digit code.");
      return;
    }

    setLoading(true);
    setStatus("Creating challenge…");

    try {
      const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
      if (chErr) throw chErr;
      if (!ch?.id) throw new Error("Challenge did not return an id.");

      setStatus("Verifying…");

      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: ch.id,
        code: otp,
      });
      if (vErr) throw vErr;

      setStatus("Verified. Finalizing session…");

      const { error: refErr } = await supabase.auth.refreshSession();
      if (refErr) throw refErr;

      if (trustThisDevice) {
        await fetch("/api/user/trust-device", { method: "POST", credentials: "include" }).catch(() => {});
      }

      window.location.href = "/dashboard";
    } catch (e: any) {
      setStatus(e?.message ?? "Verification failed.");
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 720, margin: "24px auto", padding: "0 18px" }}>
      <h1 style={{ fontSize: 28, margin: 0 }}>MFA Verification</h1>

      <GlassCard title="Authenticator required">
        <div style={{ display: "grid", gap: 12, maxWidth: 520 }}>
          <div style={{ opacity: 0.85 }}>
            Platform Admin access requires a 6-digit code from your authenticator app.
          </div>

          <input
            placeholder="6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            style={{ padding: 10, borderRadius: 12 }}
            inputMode="numeric"
            autoComplete="one-time-code"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !loading && factorId && code.trim().length === 6) verify();
            }}
          />

          <label style={{ display: "flex", gap: 10, alignItems: "center", opacity: 0.9 }}>
            <input
              type="checkbox"
              checked={trustThisDevice}
              onChange={(e) => setTrustThisDevice(e.target.checked)}
            />
            Trust this device for 24 hours (skip MFA redirect on this browser)
          </label>

          <button
            onClick={verify}
            disabled={loading || !factorId || code.trim().length !== 6}
            style={{ padding: 10, borderRadius: 12, fontWeight: 900, opacity: loading ? 0.7 : 1 }}
          >
            {loading ? "Verifying…" : "Verify"}
          </button>

          <div style={{ fontSize: 12, opacity: 0.75 }}>{status}</div>
        </div>
      </GlassCard>
    </div>
  );
}
