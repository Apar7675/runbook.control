"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import ControlActionButton from "@/components/control/ControlActionButton";
import ControlPanel from "@/components/control/ControlPanel";
import { controlTheme as t } from "@/components/control/controlTheme";
import { getBrowserSupabase } from "@/lib/supabase/browser";

export const dynamic = "force-dynamic";

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
  return error instanceof Error ? error.message : "Could not update password.";
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = useMemo(() => getBrowserSupabase(), []);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function updatePassword() {
    setStatus("");
    setBusy(true);

    try {
      const nextPassword = password.trim();
      const nextConfirm = confirmPassword.trim();

      if (!nextPassword) {
        setStatus("Enter a new password.");
        return;
      }

      if (nextPassword.length < 8) {
        setStatus("Password must be at least 8 characters.");
        return;
      }

      if (nextPassword !== nextConfirm) {
        setStatus("Passwords do not match.");
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: nextPassword });
      if (error) {
        setStatus(error.message);
        return;
      }

      router.replace("/shops");
      router.refresh();
    } catch (err: unknown) {
      setStatus(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 18, background: t.color.appBg }}>
      <div style={{ display: "grid", gap: 14, width: "min(100%, 460px)" }}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.9, textTransform: "uppercase", color: t.color.textMuted }}>
            RunBook Control
          </div>
          <h1 style={{ margin: 0, fontSize: 30, lineHeight: 1.08, color: t.color.text }}>Reset password</h1>
        </div>

        <ControlPanel title="Choose a new password" description="Update your platform-admin password, then return to the protected Control shell.">
          <div style={{ display: "grid", gap: 10 }}>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password"
              type="password"
              autoComplete="new-password"
              style={inputStyle}
            />

            <input
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              type="password"
              autoComplete="new-password"
              style={inputStyle}
              onKeyDown={(e) => {
                if (e.key === "Enter") updatePassword();
              }}
            />

            <ControlActionButton
              onClick={updatePassword}
              disabled={busy}
              tone="primary"
              style={{ width: "fit-content" }}
            >
              {busy ? "Saving..." : "Save New Password"}
            </ControlActionButton>

            {status ? (
              <div style={{ fontSize: 12, color: t.color.textSecondary, whiteSpace: "pre-wrap" }}>
                {status}
              </div>
            ) : null}
          </div>
        </ControlPanel>
      </div>
    </div>
  );
}
