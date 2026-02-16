"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import GlassCard from "@/components/GlassCard";

export const dynamic = "force-dynamic";

export default function CompanyOnboardingPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function create() {
    const n = name.trim();
    if (n.length < 2) {
      setMsg("Company / shop name required.");
      return;
    }

    setBusy(true);
    setMsg("");

    try {
      const res = await fetch("/api/onboarding/create-shop", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: n }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setMsg(data?.error ?? "Failed to create shop.");
        return;
      }

      const shopId = String(data.shop_id ?? "").trim();
      if (!shopId) {
        setMsg("Shop created but shop_id missing.");
        return;
      }

      router.push(`/shops/${shopId}/billing`);
    } catch (e: any) {
      setMsg(e?.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 720 }}>
      <h1 style={{ margin: 0, fontSize: 30 }}>Set up your company</h1>

      <GlassCard title="Step 2 of 2 — Company">
        <div style={{ display: "grid", gap: 12 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Company / shop name" style={{ padding: 10, borderRadius: 12 }} />

          <button onClick={create} disabled={busy} style={{ padding: "10px 14px", borderRadius: 12, fontWeight: 900, width: "fit-content" }}>
            {busy ? "Creating..." : "Continue to Billing"}
          </button>

          {msg ? <div style={{ fontSize: 12, opacity: 0.85 }}>{msg}</div> : null}
        </div>
      </GlassCard>
    </div>
  );
}
