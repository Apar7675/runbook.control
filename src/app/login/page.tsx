"use client";

import React, { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import GlassCard from "@/components/GlassCard";

export const dynamic = "force-dynamic";

function sanitizeNext(raw: string | null) {
  const fallback = "/shops";
  const next = (raw ?? "").trim();

  if (!next) return fallback;
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("/login")) return fallback;
  if (next.startsWith("/signup")) return fallback;

  // You previously used /dashboard as fallback, but that route doesn't exist in your project.
  if (next === "/dashboard") return fallback;

  return next;
}

function LoginInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sanitizeNext(sp.get("next"));

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
    } catch (err: any) {
      setStatus(err?.message ?? "Login failed");
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
    } catch (err: any) {
      setStatus(err?.message ?? "Failed to send magic link");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 520 }}>
      <h1 style={{ margin: 0, fontSize: 28 }}>Login</h1>

      <GlassCard title="Sign in">
        <div style={{ display: "grid", gap: 12 }}>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            autoComplete="email"
            style={{ padding: 10, borderRadius: 12 }}
          />

          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            type="password"
            autoComplete="current-password"
            style={{ padding: 10, borderRadius: 12 }}
            onKeyDown={(e) => {
              if (e.key === "Enter") signInEmailPassword();
            }}
          />

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={signInEmailPassword}
              disabled={busy}
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                fontWeight: 900,
              }}
            >
              {busy ? "Signing in..." : "Sign in"}
            </button>

            <button
              onClick={sendMagicLink}
              disabled={busy}
              style={{
                padding: "10px 14px",
                borderRadius: 12,
              }}
            >
              Send magic link
            </button>
          </div>

          {status && (
            <div style={{ fontSize: 12, opacity: 0.85, whiteSpace: "pre-wrap" }}>
              {status}
            </div>
          )}

          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Redirect after login: <span style={{ fontWeight: 900 }}>{next}</span>
          </div>

          <div style={{ fontSize: 12, opacity: 0.75 }}>
            New here?{" "}
            <Link href={`/signup?next=${encodeURIComponent(next)}`} style={{ fontWeight: 900 }}>
              Create an account
            </Link>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24, opacity: 0.75 }}>Loading...</div>}>
      <LoginInner />
    </Suspense>
  );
}
