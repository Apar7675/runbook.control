"use client";

import React, { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import GlassCard from "@/components/GlassCard";

export const dynamic = "force-dynamic";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!url || !anon) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return createBrowserClient(url, anon);
}

function LoginInner() {
  const router = useRouter();
  const sp = useSearchParams();

  // Optional redirect target: /login?next=/devices
  const next = (sp.get("next") ?? "/").trim() || "/";

  const supabase = useMemo(() => getSupabase(), []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function signInEmailPassword() {
    setStatus("");
    setBusy(true);
    try {
      const e = email.trim();
      if (!e) return setStatus("Enter email.");
      if (!password) return setStatus("Enter password.");

      const { error } = await supabase.auth.signInWithPassword({ email: e, password });
      if (error) return setStatus(error.message);

      router.replace(next);
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
      if (!e) return setStatus("Enter email.");

      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
          : undefined;

      const { error } = await supabase.auth.signInWithOtp({
        email: e,
        options: { emailRedirectTo: redirectTo },
      });

      if (error) return setStatus(error.message);

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
          />

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={signInEmailPassword}
              disabled={busy}
              style={{ padding: "10px 14px", borderRadius: 12, fontWeight: 900 }}
            >
              Sign in
            </button>

            <button
              onClick={sendMagicLink}
              disabled={busy}
              style={{ padding: "10px 14px", borderRadius: 12 }}
            >
              Send magic link
            </button>
          </div>

          {status ? (
            <div style={{ fontSize: 12, opacity: 0.85, whiteSpace: "pre-wrap" }}>
              {status}
            </div>
          ) : null}

          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Tip: you can pass a redirect like <span style={{ fontWeight: 900 }}>/login?next=/devices</span>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

export default function LoginPage() {
  // Required by Next.js when using useSearchParams() on a page:
  // it must be inside a Suspense boundary to avoid CSR bailout build failure.
  return (
    <Suspense fallback={<div style={{ padding: 24, opacity: 0.75 }}>Loading…</div>}>
      <LoginInner />
    </Suspense>
  );
}
