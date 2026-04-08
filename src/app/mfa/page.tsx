"use client";

import React, { useEffect, useMemo, useState } from "react";
import GlassCard from "@/components/GlassCard";
import { supabaseBrowser } from "@/lib/supabase/client";

type MfaMode = "loading" | "enroll" | "verify";
type TotpFactor = {
  id: string;
  factor_type: string;
  status?: string | null;
};

export default function MFAPage() {
  const supabase = useMemo(() => supabaseBrowser(), []);

  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("Loading MFA factors...");
  const [loading, setLoading] = useState(false);
  const [trustThisDevice, setTrustThisDevice] = useState(true);
  const [mode, setMode] = useState<MfaMode>("loading");

  async function cleanupUnverifiedTotpFactors() {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) throw error;

    const allFactors = ((data?.all ?? []) as TotpFactor[]);
    const staleFactors = allFactors.filter((factor) => factor.factor_type === "totp" && factor.status !== "verified");

    for (const factor of staleFactors) {
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
      if (unenrollError) throw unenrollError;
    }

    return {
      verifiedTotp: ((data?.totp ?? []) as TotpFactor[]).filter((factor) => factor.status === "verified"),
    };
  }

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setStatus("Loading MFA factors...");

      await fetch("/api/user/ensure-device-id", {
        method: "POST",
        credentials: "include",
      }).catch(() => {});

      const { verifiedTotp } = await cleanupUnverifiedTotpFactors().catch((error) => {
        if (!cancelled) {
          setStatus(error?.message ?? "Could not load MFA factors.");
          setMode("enroll");
        }

        return { verifiedTotp: [] as TotpFactor[] };
      });
      if (cancelled) return;

      const totp = verifiedTotp[0] ?? null;
      if (!totp?.id) {
        setFactorId(null);
        setQrCode(null);
        setMode("enroll");
        setStatus("No authenticator is enabled for this account yet. Enroll one below to continue.");
        return;
      }

      setFactorId(totp.id);
      setQrCode(null);
      setMode("verify");
      setStatus("Enter the 6-digit code from your authenticator app.");
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function startEnroll() {
    setLoading(true);
    setStatus("Starting authenticator enrollment...");

    try {
      await cleanupUnverifiedTotpFactors();

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        issuer: "RunBook Control",
      });

      if (error) throw error;
      if (!data?.id) throw new Error("Authenticator enrollment did not return a factor id.");

      setFactorId(data.id);
      setQrCode(data.totp?.qr_code ?? null);
      setCode("");
      setMode("verify");
      setStatus("Scan the QR code with your authenticator app, then enter the current 6-digit code to finish setup.");
    } catch (e: any) {
      setStatus(e?.message ?? "Could not start authenticator enrollment.");
    } finally {
      setLoading(false);
    }
  }

  async function verify() {
    if (!factorId) return;

    const otp = code.trim();
    if (otp.length !== 6) {
      setStatus("Enter a valid 6-digit code.");
      return;
    }

    setLoading(true);
    setStatus(qrCode ? "Enabling authenticator..." : "Verifying...");

    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code: otp,
      });
      if (error) throw error;

      setStatus("Verified. Finalizing session...");

      const { error: refErr } = await supabase.auth.refreshSession();
      if (refErr) throw refErr;

      if (trustThisDevice) {
        await fetch("/api/user/trust-device", {
          method: "POST",
          credentials: "include",
        }).catch(() => {});
      }

      window.location.href = "/dashboard";
    } catch (e: any) {
      const message = String(e?.message ?? "Verification failed.");
      if (/invalid totp code entered/i.test(message)) {
        setStatus("Invalid TOTP code entered. Check that you scanned the newest QR code and that your phone time is set automatically, then try the current 6-digit code again.");
      } else {
        setStatus(message);
      }
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

          {mode === "enroll" ? (
            <button
              onClick={startEnroll}
              disabled={loading}
              style={{ padding: 10, borderRadius: 12, fontWeight: 900, opacity: loading ? 0.7 : 1 }}
            >
              {loading ? "Starting..." : "Enable Authenticator App"}
            </button>
          ) : null}

          {qrCode ? (
            <div style={{ display: "grid", gap: 10, justifyItems: "start" }}>
              <div style={{ fontSize: 13, opacity: 0.85 }}>
                Scan this QR code in Google Authenticator, Microsoft Authenticator, 1Password, or another TOTP app.
              </div>
              <img
                src={qrCode}
                alt="Authenticator QR code"
                style={{
                  width: 220,
                  height: 220,
                  borderRadius: 16,
                  padding: 12,
                  background: "white",
                }}
              />
            </div>
          ) : null}

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
            {loading ? "Working..." : qrCode ? "Enable and Verify" : "Verify"}
          </button>

          <div style={{ fontSize: 12, opacity: 0.75 }}>{status}</div>
        </div>
      </GlassCard>
    </div>
  );
}
