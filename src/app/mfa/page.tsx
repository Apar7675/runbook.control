"use client";

import { useEffect, useState, type CSSProperties } from "react";
import EnableMFAClient from "@/components/EnableMFAClient";
import ControlActionButton from "@/components/control/ControlActionButton";
import ControlPanel from "@/components/control/ControlPanel";
import { controlTheme as t } from "@/components/control/controlTheme";
import { supabaseBrowser } from "@/lib/supabase/client";
import { mfaReturnFromRequestPath } from "@/lib/auth/mfaReturn";

const inputStyle: CSSProperties = {
  minHeight: 38,
  padding: "0 11px",
  borderRadius: t.radius.sm,
  border: `1px solid ${t.color.softBorder}`,
  background: "#ffffff",
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
  const [canEnroll, setCanEnroll] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setStatus("Loading MFA factors...");

      const { data, error } = await supabase.auth.mfa.listFactors();
      if (cancelled) return;

      if (error) {
        setStatus(error.message);
        return;
      }

      const totp = (data?.totp ?? []).find((factor) => factor.status === "verified");
      if (!totp?.id) {
        setCanEnroll(true);
        setStatus("Set up an authenticator app to continue.");
        return;
      }

      setCanEnroll(false);
      setFactorId(totp.id);
      setStatus("Enter the 6-digit code from your authenticator app.");
    }

    void init().catch((error: unknown) => { if (!cancelled) setStatus(errorMessage(error)); });
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function verify() {
    if (!factorId) return;

    const otp = code.trim();
    if (!/^\d{6}$/.test(otp)) {
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

      const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assuranceError) throw assuranceError;
      if (assurance?.currentLevel !== "aal2") throw new Error("MFA verification did not establish an AAL2 session. Try again.");

      window.location.href = mfaReturnFromRequestPath("/mfa" + window.location.search);
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

      <ControlPanel title="Authenticator required" description="Verify your authenticator to continue with Control administration. You will return to your previous page; submit the action again after verification.">
        {canEnroll ? <EnableMFAClient required returnTo={mfaReturnFromRequestPath("/mfa" + window.location.search)} /> : <div style={{ display: "grid", gap: 10 }}>
          <input
            placeholder="6-digit code"
            aria-label="6-digit authenticator code"
            disabled={loading}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            style={inputStyle}
            inputMode="numeric"
            autoComplete="one-time-code"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !loading && factorId && code.trim().length === 6) verify();
            }}
          />


          <ControlActionButton
            onClick={verify}
            disabled={loading || !factorId || code.trim().length !== 6}
            tone="primary"
            style={{ width: "fit-content" }}
          >
            {loading ? "Verifying..." : "Verify"}
          </ControlActionButton>

          <div role="status" aria-live="polite" style={{ fontSize: 12, color: t.color.textMuted }}>{status}</div>
        </div>}
      </ControlPanel>
    </div>
  );
}
