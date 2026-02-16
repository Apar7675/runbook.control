"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import GlassCard from "@/components/GlassCard";

export const dynamic = "force-dynamic";

export default function ProfileOnboardingPage() {
  const router = useRouter();

  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function save() {
    if (!first.trim() || !last.trim()) {
      setMsg("First and last name required.");
      return;
    }

    setBusy(true);
    setMsg("");

    try {
      const res = await fetch("/api/onboarding/save-profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          first_name: first.trim(),
          last_name: last.trim(),
          phone: phone.trim() || null,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setMsg(data?.error ?? "Failed to save profile.");
        return;
      }

      router.push("/onboarding/company");
    } catch (e: any) {
      setMsg(e?.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 720 }}>
      <h1 style={{ margin: 0, fontSize: 30 }}>Welcome to RunBook</h1>

      <GlassCard title="Step 1 of 2 — Your info">
        <div style={{ display: "grid", gap: 12 }}>
          <input value={first} onChange={(e) => setFirst(e.target.value)} placeholder="First name" style={{ padding: 10, borderRadius: 12 }} />
          <input value={last} onChange={(e) => setLast(e.target.value)} placeholder="Last name" style={{ padding: 10, borderRadius: 12 }} />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (optional)" style={{ padding: 10, borderRadius: 12 }} />

          <button onClick={save} disabled={busy} style={{ padding: "10px 14px", borderRadius: 12, fontWeight: 900, width: "fit-content" }}>
            {busy ? "Saving..." : "Continue"}
          </button>

          {msg ? <div style={{ fontSize: 12, opacity: 0.85 }}>{msg}</div> : null}
        </div>
      </GlassCard>
    </div>
  );
}
