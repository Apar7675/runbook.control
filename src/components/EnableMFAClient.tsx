"use client";

import React, { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type Props = { required?: boolean };

export default function EnableMFAClient({ required }: Props) {
  const supabase = supabaseBrowser();

  const [hasTotp, setHasTotp] = useState<boolean | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (cancelled) return;

      if (error) {
        setStatus(error.message);
        setHasTotp(false);
        return;
      }

      setHasTotp((data?.totp ?? []).length > 0);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function startEnroll() {
    setStatus("Starting MFA enrollment…");

    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    if (error) return setStatus(error.message);

    // show QR by opening a simple modal-less flow
    // easiest: just open a new tab to settings with qr in memory is hard
    // so instead: alert with QR data URL if needed
    // better UX is possible later; for now we keep it simple:
    setStatus("Enrollment started. Open this page in a new tab and complete scan + verify in the QR flow (coming next).");
    console.log("TOTP QR:", data.totp.qr_code);
  }

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 560 }}>
      {required ? (
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(139,140,255,0.10)",
            fontWeight: 900,
          }}
        >
          MFA is required for Platform Admins.
        </div>
      ) : null}

      <div style={{ fontWeight: 900, fontSize: 16 }}>Two-Factor Authentication (Authenticator App)</div>

      {hasTotp === null ? (
        <div style={{ opacity: 0.8 }}>Loading…</div>
      ) : hasTotp ? (
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ opacity: 0.85 }}>Status: <b>Enabled</b></div>
          <button
            onClick={() => (window.location.href = "/mfa")}
            style={{ padding: 10, borderRadius: 12, fontWeight: 900 }}
          >
            Verify now
          </button>
        </div>
      ) : (
        <button onClick={startEnroll} style={{ padding: 10, borderRadius: 12, fontWeight: 900 }}>
          Enable Authenticator App
        </button>
      )}

      {status ? <div style={{ opacity: 0.85 }}>{status}</div> : null}
    </div>
  );
}
