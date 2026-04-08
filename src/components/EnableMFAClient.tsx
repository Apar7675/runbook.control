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
    setStatus("Starting MFA enrollment...");

    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    if (error) return setStatus(error.message);

    setStatus("Enrollment started. Complete scan and verification in the MFA flow next.");
    console.log("TOTP QR:", data.totp.qr_code);
  }

  return (
    <div className="rb-stack" style={{ maxWidth: 560 }}>
      {required ? (
        <div className="rb-inlineNotice" style={{ fontWeight: 900 }}>
          MFA is required for Platform Admins.
        </div>
      ) : null}

      <div className="rb-sectionSurface">
        <div className="rb-stack" style={{ gap: 12 }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>Two-Factor Authentication (Authenticator App)</div>

          {hasTotp === null ? (
            <div className="rb-fine">Loading...</div>
          ) : hasTotp ? (
            <div className="rb-stack" style={{ gap: 10 }}>
              <div className="rb-pageCopy">Status: <strong>Enabled</strong></div>
              <div className="rb-inlineRow">
                <button onClick={() => (window.location.href = "/mfa")} className="rb-button rb-button--primary">
                  Verify now
                </button>
              </div>
            </div>
          ) : (
            <div className="rb-inlineRow">
              <button onClick={startEnroll} className="rb-button rb-button--primary">
                Enable Authenticator App
              </button>
            </div>
          )}

          {status ? <div className="rb-pageCopy">{status}</div> : null}
        </div>
      </div>
    </div>
  );
}
