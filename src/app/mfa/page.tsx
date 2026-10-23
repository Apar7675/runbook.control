"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import EnableMFAClient from "@/components/EnableMFAClient";
import ControlActionButton from "@/components/control/ControlActionButton";
import ControlPanel from "@/components/control/ControlPanel";
import { controlTheme as t } from "@/components/control/controlTheme";
import { supabaseBrowser } from "@/lib/supabase/client";
import { mfaReturnFromRequestPath } from "@/lib/auth/mfaReturn";
import { loadTotpEnrollmentState, verifyExistingTotp } from "@/lib/auth/mfaEnrollment";

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
  const [userId, setUserId] = useState<string | null>(null);
  const active = useRef(false);
  const epoch = useRef(0);
  const busy = useRef(false);
  const userRef = useRef<string | null>(null);

  useEffect(() => {
    active.current = true;
    const generation = epoch.current;
    // Subscribe before loading so a sign-in during initial loading retires it too.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active.current) return;
      if (event !== "INITIAL_SESSION" || (userRef.current && session?.user.id !== userRef.current)) {
        epoch.current++;
        userRef.current = null;
        busy.current = false;
        setFactorId(null);
        setUserId(null);
        setCode("");
        setLoading(false);
        setCanEnroll(false);
        setStatus("The signed-in session changed. Reload before continuing.");
      }
    });
    setStatus("Loading MFA factors...");
    loadTotpEnrollmentState(supabase.auth).then((state) => {
      if (!active.current || generation !== epoch.current) return;
      userRef.current = state.userId;
      setUserId(state.userId);
      setFactorId(state.verifiedFactorId);
      setCanEnroll(!state.enabled);
      setStatus(state.enabled ? "Enter the 6-digit code from your authenticator app." : "Set up an authenticator app to continue.");
    }).catch((error: unknown) => {
      if (active.current && generation === epoch.current) setStatus(errorMessage(error));
    });
    return () => {
      active.current = false;
      epoch.current++;
      subscription.unsubscribe();
    };
  }, [supabase]);

  function valid(generation: number) {
    return active.current && generation === epoch.current;
  }

  async function verify() {
    if (!factorId || !userId || busy.current) return;
    const otp = code.trim();
    if (!/^\d{6}$/.test(otp)) {
      setStatus("Enter a valid 6-digit code.");
      return;
    }
    const generation = epoch.current;
    busy.current = true;
    setLoading(true);
    setStatus("Verifying authenticator...");
    try {
      await verifyExistingTotp(supabase.auth, userId, factorId, otp, () => valid(generation));
      if (valid(generation)) window.location.href = mfaReturnFromRequestPath("/mfa" + window.location.search);
    } catch (error: unknown) {
      if (valid(generation)) setStatus(errorMessage(error));
    } finally {
      if (valid(generation)) { busy.current = false; setLoading(false); }
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
