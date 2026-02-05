"use client";

import React, { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const redirectTo = useMemo(() => sp.get("redirectTo") ?? "/dashboard", [sp]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    setMsg(null);
    setBusy(true);

    try {
      console.log("[login] submit", { email });

      const supabase = supabaseBrowser();

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      console.log("[login] result", { data, error });

      if (error) {
        setMsg(error.message);
        setBusy(false);
        return;
      }

      // Immediately verify session exists client-side
      const sessionRes = await supabase.auth.getSession();
      console.log("[login] getSession()", sessionRes);

      if (!sessionRes.data.session) {
        setMsg("Signed in but no session returned. Check cookies/middleware/server client wiring.");
        setBusy(false);
        return;
      }

      setMsg("Signed in. Redirecting…");

      // Force app router to re-evaluate server components/middleware
      router.replace(redirectTo);
      router.refresh();
    } catch (err: any) {
      console.error("[login] exception", err);
      setMsg(err?.message ?? String(err));
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ width: 420, maxWidth: "100%", padding: 20, borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)" }}>
        <h1 style={{ fontSize: 22, marginBottom: 12 }}>RunBook Control</h1>

        <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ opacity: 0.8 }}>Email</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              inputMode="email"
              placeholder="you@domain.com"
              style={{ padding: 10, borderRadius: 10, border: "1px solid rgba(255,255,255,0.18)", background: "transparent" }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ opacity: 0.8 }}>Password</span>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              style={{ padding: 10, borderRadius: 10, border: "1px solid rgba(255,255,255,0.18)", background: "transparent" }}
            />
          </label>

          <button
            type="submit"
            disabled={busy || !email.trim() || !password}
            style={{
              padding: 12,
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.18)",
              background: busy ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.12)",
              cursor: busy ? "not-allowed" : "pointer",
              fontWeight: 600,
              marginTop: 6,
            }}
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>

          {msg ? (
            <div style={{ marginTop: 10, padding: 10, borderRadius: 10, border: "1px solid rgba(255,255,255,0.18)", opacity: 0.9 }}>
              {msg}
            </div>
          ) : null}

          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
            Debug: open DevTools Console. You should see <code>[login] submit</code> and <code>[login] result</code>.
          </div>
        </form>
      </div>
    </div>
  );
}
