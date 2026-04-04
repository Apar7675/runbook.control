"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import GlassCard from "@/components/GlassCard";

type StatePayload = {
  ok: true;
  state: {
    shop_name: string;
    email_verified: boolean;
    phone_verified: boolean;
    resolved_route: string;
  };
};

export default function CompanyOnboardingClient() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [loadingState, setLoadingState] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    async function loadState() {
      try {
        const res = await fetch("/api/onboarding/state", { cache: "no-store" });
        const data = (await res.json().catch(() => null)) as StatePayload | { ok?: false; error?: string } | null;
        if (!res.ok || !data || (data as any).ok !== true) {
          setMsg("Finish your profile verification first, then come back here to create the shop.");
          setLoadingState(false);
          return;
        }

        const state = (data as StatePayload).state;
        if (state.resolved_route && state.resolved_route !== "/onboarding/company") {
          router.replace(state.resolved_route);
          return;
        }

        setName(state.shop_name ?? "");
        setEmailVerified(Boolean(state.email_verified));
        setPhoneVerified(Boolean(state.phone_verified));
      } finally {
        setLoadingState(false);
      }
    }

    loadState();
  }, [router]);

  async function create() {
    const n = name.trim();
    if (n.length < 2) {
      setMsg("Enter your company or shop name before continuing.");
      return;
    }
    if (!emailVerified || !phoneVerified) {
      setMsg("Your email and phone must both be verified before you can start a trial.");
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
        setMsg(data?.error ?? "We could not create the shop.");
        return;
      }

      const shopId = String(data.shop_id ?? "").trim();
      if (!shopId) {
        setMsg("The shop was created, but we could not finish the redirect.");
        return;
      }

      if (data?.trial_restricted) {
        const field =
          data?.reuse_risk?.field === "device_id"
            ? "device"
            : data?.reuse_risk?.field === "email"
            ? "email"
            : data?.reuse_risk?.field === "phone"
            ? "phone number"
            : "identity";

        setMsg(
          `Your shop was created, but trial access is restricted because this ${field} was already used for a previous trial. We’ll still guide you through setup so you can review the account state.`
        );

        window.setTimeout(() => {
          router.push("/onboarding/setup");
        }, 1200);
        return;
      }

      setMsg(data?.message ?? "Shop created. Moving you into setup.");
      router.push("/onboarding/setup");
    } catch (e: any) {
      setMsg(e?.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 720 }}>
      <h1 style={{ margin: 0, fontSize: 30 }}>Set up your company</h1>

      <GlassCard title="Step 2 of 2 - Company">
        <div style={{ display: "grid", gap: 12 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Company / shop name" style={{ padding: 10, borderRadius: 12 }} />

          <div style={{ fontSize: 12, opacity: 0.78 }}>
            We check your identity details before issuing a new trial. If your email, phone, or device was already used, the account may be restricted for review.
          </div>

          <button onClick={create} disabled={busy || loadingState} style={{ padding: "10px 14px", borderRadius: 12, fontWeight: 900, width: "fit-content" }}>
            {busy ? "Creating..." : "Continue to Setup"}
          </button>

          {msg ? <div style={{ fontSize: 12, opacity: 0.85 }}>{msg}</div> : null}
        </div>
      </GlassCard>
    </div>
  );
}
