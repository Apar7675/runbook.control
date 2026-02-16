"use client";

import React, { Suspense, useMemo, useState } from "react";
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

  return next;
}

function SignupInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sanitizeNext(sp.get("next"));

  const supabase = useMemo(() => getBrowserSupabase(), []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function signUpEmailPassword() {
    setStatus("");
    setBusy(true);

    try {
      const e = email.trim();

      if (!e) {
        setStatus("Enter email.");
        return;
      }

      if (!password || password.length < 8) {
        setStatus("Password must be at least 8 characters.");
        return;
      }

      const { data, error } = await supabase.auth.signUp({
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
        setStatus("Account created. Check your email to confirm, then login.");
        router.replace(`/login?next=${encodeURIComponent(next)}`);
        return;
      }

      router.replace(next);
      router.refresh();
    } catch (err: any) {
      setStatus(err?.message ?? "Signup failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 520 }}>
      <h1 style={{ margin: 0, fontSize: 28 }}>Create Account</h1>

      <GlassCard title="Sign up">
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
            autoComplete="new-password"
            style={{ padding: 10, borderRadius: 12 }}
          />

          <button
            onClick={signUpEmailPassword}
            disabled={busy}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              fontWeight: 900,
            }}
          >
            {busy ? "Creating..." : "Create Account"}
          </button>

          {status && (
            <div style={{ fontSize: 12, opacity: 0.85 }}>
              {status}
            </div>
          )}

          <div style={{ fontSize: 12, opacity: 0.7 }}>
            After signup you’ll create your shop and start your 30-day trial.
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24, opacity: 0.75 }}>Loading...</div>}>
      <SignupInner />
    </Suspense>
  );
}
