"use client";

import React, { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ControlActionButton from "@/components/control/ControlActionButton";
import ControlPanel from "@/components/control/ControlPanel";
import { controlTheme as t } from "@/components/control/controlTheme";
import { getBrowserSupabase } from "@/lib/supabase/browser";

export const dynamic = "force-dynamic";

function sanitizeNext(raw: string | null) {
  const fallback = "/dashboard";
  const next = (raw ?? "").trim();

  if (!next) return fallback;
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("/login")) return fallback;
  if (next.startsWith("/signup")) return fallback;

  return next;
}

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 38,
  padding: "0 11px",
  borderRadius: t.radius.sm,
  border: `1px solid ${t.color.softBorder}`,
  background: "rgba(7, 10, 15, 0.68)",
  color: t.color.text,
  outline: "none",
};

function LoginInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sanitizeNext(sp.get("next"));
  const callbackError = (sp.get("message") ?? sp.get("error") ?? "").trim();

  // SINGLE browser client instance
  const supabase = useMemo(() => getBrowserSupabase(), []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function signInEmailPassword() {
    setStatus("");
    setBusy(true);

    try {
      const e = email.trim();

      if (!e) {
        setStatus("Enter email.");
        return;
      }

      if (!password) {
        setStatus("Enter password.");
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: e,
        password,
      });

      if (error) {
        setStatus(error.message);
        return;
      }

      const session =
        data?.session ?? (await supabase.auth.getSession()).data.session;

      if (!session) {
        setStatus("Signed in, but no session was established. Check Supabase auth settings.");
        return;
      }

      router.replace(next);
      router.refresh();
    } catch (err: unknown) {
      setStatus(errorMessage(err, "Login failed"));
    } finally {
      setBusy(false);
    }
  }

  async function sendMagicLink() {
    setStatus("");
    setBusy(true);

    try {
      const e = email.trim();
      if (!e) {
        setStatus("Enter email.");
        return;
      }

      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
          : undefined;

      const { error } = await supabase.auth.signInWithOtp({
        email: e,
        options: { emailRedirectTo: redirectTo },
      });

      if (error) {
        setStatus(error.message);
        return;
      }

      setStatus("Magic link sent. Check your email.");
    } catch (err: unknown) {
      setStatus(errorMessage(err, "Failed to send magic link"));
    } finally {
      setBusy(false);
    }
  }

  async function sendPasswordReset() {
    setStatus("");
    setBusy(true);

    try {
      const e = email.trim();
      if (!e) {
        setStatus("Enter email.");
        return;
      }

      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/callback?next=${encodeURIComponent("/reset-password")}&type=recovery`
          : undefined;

      const { error } = await supabase.auth.resetPasswordForEmail(e, {
        redirectTo,
      });

      if (error) {
        setStatus(error.message);
        return;
      }

      setStatus("Password reset link sent. Check your email.");
    } catch (err: unknown) {
      setStatus(errorMessage(err, "Failed to send password reset email"));
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
          <h1 style={{ margin: 0, fontSize: 30, lineHeight: 1.08, color: t.color.text }}>Platform admin login</h1>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: t.color.textMuted }}>
            Customer setup is completed from RunBook Desktop. Control web access is restricted to platform administrators.
          </p>
        </div>

        <ControlPanel title="Sign in" description="Use your platform-admin credentials. MFA/AAL2 is enforced by the protected Control shell.">
          <div style={{ display: "grid", gap: 10 }}>
            {callbackError ? (
              <div style={{ fontSize: 12, color: "#FECACA", whiteSpace: "pre-wrap" }}>
                {callbackError}
              </div>
            ) : null}

            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              autoComplete="email"
              style={inputStyle}
            />

            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              type="password"
              autoComplete="current-password"
              style={inputStyle}
              onKeyDown={(e) => {
                if (e.key === "Enter") signInEmailPassword();
              }}
            />

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <ControlActionButton
                onClick={signInEmailPassword}
                disabled={busy}
                tone="primary"
              >
                {busy ? "Signing in..." : "Sign in"}
              </ControlActionButton>

              <ControlActionButton
                onClick={sendMagicLink}
                disabled={busy}
              >
                Send magic link
              </ControlActionButton>

              <ControlActionButton
                onClick={sendPasswordReset}
                disabled={busy}
              >
                Forgot password
              </ControlActionButton>
            </div>

            {status && (
              <div style={{ fontSize: 12, color: t.color.textSecondary, whiteSpace: "pre-wrap" }}>
                {status}
              </div>
            )}

            <div style={{ fontSize: 12, color: t.color.textMuted }}>
              Redirect after login: <span style={{ fontWeight: 900 }}>{next}</span>
            </div>

            <div style={{ fontSize: 12, color: t.color.textMuted, lineHeight: 1.5 }}>
              Access to RunBook Control is provisioned for platform administrators only. Customer setup is completed from RunBook Desktop.
            </div>
          </div>
        </ControlPanel>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ padding: 18, color: t.color.textMuted }}>Loading...</div>}>
      <LoginInner />
    </Suspense>
  );
}
