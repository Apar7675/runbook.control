"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import GlassCard from "@/components/GlassCard";
import { getBrowserSupabase } from "@/lib/supabase/browser";

export const dynamic = "force-dynamic";

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
    } catch (err: any) {
      setStatus(err?.message ?? "Could not update password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 520 }}>
      <h1 style={{ margin: 0, fontSize: 28 }}>Reset Password</h1>

      <GlassCard title="Choose a new password">
        <div style={{ display: "grid", gap: 12 }}>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New password"
            type="password"
            autoComplete="new-password"
            style={{ padding: 10, borderRadius: 12 }}
          />

          <input
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            type="password"
            autoComplete="new-password"
            style={{ padding: 10, borderRadius: 12 }}
            onKeyDown={(e) => {
              if (e.key === "Enter") updatePassword();
            }}
          />

          <button
            onClick={updatePassword}
            disabled={busy}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              fontWeight: 900,
              width: "fit-content",
            }}
          >
            {busy ? "Saving..." : "Save New Password"}
          </button>

          {status ? (
            <div style={{ fontSize: 12, opacity: 0.85, whiteSpace: "pre-wrap" }}>
              {status}
            </div>
          ) : null}
        </div>
      </GlassCard>
    </div>
  );
}
