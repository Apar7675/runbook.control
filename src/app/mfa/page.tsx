"use client";

import { useEffect, useState, type CSSProperties } from "react";
import ControlActionButton from "@/components/control/ControlActionButton";
import ControlPanel from "@/components/control/ControlPanel";
import { controlTheme as t } from "@/components/control/controlTheme";
import { supabaseBrowser } from "@/lib/supabase/client";

const inputStyle: CSSProperties = {
  minHeight: 38,
  padding: "0 11px",
  borderRadius: t.radius.sm,
  border: `1px solid ${t.color.softBorder}`,
  background: "rgba(7, 10, 15, 0.68)",
  color: t.color.text,
  outline: "none",
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Verification failed.";
}

export default function MFAPage() {
  const supabase = supabaseBrowser();

  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("Loading...");
  const [loading, setLoading] = useState(false);
  const [trustThisDevice, setTrustThisDevice] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setStatus("Loading MFA factors...");

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
    setStatus("Creating challenge...");

    try {
      const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
      if (chErr) throw chErr;
      if (!ch?.id) throw new Error("Challenge did not return an id.");

      setStatus("Verifying...");

      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: ch.id,
        code: otp,
      });
      if (vErr) throw vErr;

      setStatus("Verified. Finalizing session...");

      const { error: refErr } = await supabase.auth.refreshSession();
      if (refErr) throw refErr;

      if (trustThisDevice) {
        await fetch("/api/user/trust-device", { method: "POST", credentials: "include" }).catch(() => {});
      }

      window.location.href = "/shops";
    } catch (e: unknown) {
      setStatus(errorMessage(e));
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 14, width: "min(100%, 520px)", margin: "24px auto", padding: "0 18px" }}>
      <div style={{ display: "grid", gap: 4 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.9, textTransform: "uppercase", color: t.color.textMuted }}>
          RunBook Control
        </div>
        <h1 style={{ fontSize: 30, lineHeight: 1.08, margin: 0, color: t.color.text }}>MFA verification</h1>
      </div>

      <ControlPanel title="Authenticator required" description="Platform admin access requires a 6-digit code from your authenticator app.">
        <div style={{ display: "grid", gap: 10 }}>
          <input
            placeholder="6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            style={inputStyle}
            inputMode="numeric"
            autoComplete="one-time-code"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !loading && factorId && code.trim().length === 6) verify();
            }}
          />

          <label style={{ display: "flex", gap: 8, alignItems: "center", color: t.color.textSecondary, fontSize: 12.5 }}>
            <input
              type="checkbox"
              checked={trustThisDevice}
              onChange={(e) => setTrustThisDevice(e.target.checked)}
            />
            Trust this device for 24 hours (skip MFA redirect on this browser)
          </label>

          <ControlActionButton
            onClick={verify}
            disabled={loading || !factorId || code.trim().length !== 6}
            tone="primary"
            style={{ width: "fit-content" }}
          >
            {loading ? "Verifying..." : "Verify"}
          </ControlActionButton>

          <div style={{ fontSize: 12, color: t.color.textMuted }}>{status}</div>
        </div>
      </ControlPanel>
    </div>
  );
}
