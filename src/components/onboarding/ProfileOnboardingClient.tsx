"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import GlassCard from "@/components/GlassCard";
import { getStableOnboardingDeviceId } from "@/lib/ui/onboardingDeviceId";

type StatePayload = {
  ok: true;
  state: {
    full_name: string;
    email: string;
    phone: string;
    shop_name: string;
    device_id: string | null;
    email_verified: boolean;
    phone_verified: boolean;
    current_step: string;
    resolved_route: string;
  };
};

function formatCooldown(seconds: number) {
  if (seconds <= 0) return "";
  return seconds === 1 ? "1 second" : `${seconds} seconds`;
}

export default function ProfileOnboardingClient() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [shopName, setShopName] = useState("");
  const [deviceId, setDeviceId] = useState("");

  const [emailCode, setEmailCode] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);

  const [loadingState, setLoadingState] = useState(true);
  const [busy, setBusy] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [smsBusy, setSmsBusy] = useState(false);
  const [verifyEmailBusy, setVerifyEmailBusy] = useState(false);
  const [verifySmsBusy, setVerifySmsBusy] = useState(false);

  const [msg, setMsg] = useState("");
  const [emailMsg, setEmailMsg] = useState("");
  const [smsMsg, setSmsMsg] = useState("");
  const [emailCooldown, setEmailCooldown] = useState(0);
  const [smsCooldown, setSmsCooldown] = useState(0);

  useEffect(() => {
    if (emailCooldown <= 0) return;
    const handle = window.setTimeout(() => setEmailCooldown((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearTimeout(handle);
  }, [emailCooldown]);

  useEffect(() => {
    if (smsCooldown <= 0) return;
    const handle = window.setTimeout(() => setSmsCooldown((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearTimeout(handle);
  }, [smsCooldown]);

  useEffect(() => {
    const stableDeviceId = getStableOnboardingDeviceId();
    setDeviceId(stableDeviceId);

    async function loadState() {
      try {
        const res = await fetch("/api/onboarding/state", { cache: "no-store" });
        const data = (await res.json().catch(() => null)) as StatePayload | { ok?: false; error?: string } | null;
        if (!res.ok || !data || (data as any).ok !== true) {
          setMsg("We could not load your onboarding progress. Refresh and try again.");
          setLoadingState(false);
          return;
        }

        const state = (data as StatePayload).state;
        if (state.resolved_route && state.resolved_route !== "/onboarding/profile") {
          router.replace(state.resolved_route);
          return;
        }
        setFullName(state.full_name ?? "");
        setEmail(state.email ?? "");
        setPhone(state.phone ?? "");
        setShopName(state.shop_name ?? "");
        setEmailVerified(Boolean(state.email_verified));
        setPhoneVerified(Boolean(state.phone_verified));
        setDeviceId(state.device_id ?? stableDeviceId);
      } finally {
        setLoadingState(false);
      }
    }

    loadState();
  }, [router]);

  function validateBaseFields() {
    if (!fullName.trim()) return "Enter your full name to continue.";
    if (!email.trim()) return "Enter the email address tied to this account.";
    if (!phone.trim()) return "Enter a phone number so we can verify trial access.";
    if (!shopName.trim()) return "Enter your company or shop name before verifying.";
    return "";
  }

  async function saveProfile() {
    const validation = validateBaseFields();
    if (validation) {
      setMsg(validation);
      return null;
    }

    const res = await fetch("/api/onboarding/save-profile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        shop_name: shopName.trim(),
        device_id: deviceId,
      }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      setMsg(data?.error ?? "We could not save your profile details.");
      return null;
    }

    const nextEmailVerified = Boolean(data?.state?.email_verified);
    const nextPhoneVerified = Boolean(data?.state?.phone_verified);
    setEmailVerified(nextEmailVerified);
    setPhoneVerified(nextPhoneVerified);
    return { email_verified: nextEmailVerified, phone_verified: nextPhoneVerified };
  }

  async function sendEmailCode() {
    const validation = validateBaseFields();
    if (validation) {
      setEmailMsg(validation);
      return;
    }
    if (emailCooldown > 0) {
      setEmailMsg(`Please wait ${formatCooldown(emailCooldown)} before sending another email code.`);
      return;
    }

    setEmailBusy(true);
    setEmailMsg("");
    setMsg("");

    try {
      const res = await fetch("/api/onboarding/send-email-code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          full_name: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          shop_name: shopName.trim(),
          device_id: deviceId,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setEmailMsg(data?.error ?? "We could not send the email code.");
        return;
      }

      setEmailCooldown(Number(data?.resend_available_in ?? 45));
      setEmailVerified(false);
      setEmailMsg(data?.dev_code ? `Email code sent. Dev code: ${data.dev_code}` : data?.message ?? "Email code sent. Check your inbox and spam folder.");
    } finally {
      setEmailBusy(false);
    }
  }

  async function verifyEmailCode() {
    if (!emailCode.trim()) {
      setEmailMsg("Enter the 6-digit email code before verifying.");
      return;
    }

    setVerifyEmailBusy(true);
    setEmailMsg("");

    try {
      const res = await fetch("/api/onboarding/verify-email-code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), code: emailCode.trim() }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        const attemptsRemaining = Number(data?.attempts_remaining ?? -1);
        const suffix = attemptsRemaining >= 0 && data?.reason === "invalid_code" ? ` ${attemptsRemaining} attempt${attemptsRemaining === 1 ? "" : "s"} remaining.` : "";
        setEmailMsg(`${data?.error ?? "We could not verify that email code."}${suffix}`);
        return;
      }

      setEmailVerified(true);
      setEmailMsg(data?.message ?? "Email verified.");
    } finally {
      setVerifyEmailBusy(false);
    }
  }

  async function sendSmsCode() {
    const validation = validateBaseFields();
    if (validation) {
      setSmsMsg(validation);
      return;
    }
    if (smsCooldown > 0) {
      setSmsMsg(`Please wait ${formatCooldown(smsCooldown)} before sending another SMS code.`);
      return;
    }

    setSmsBusy(true);
    setSmsMsg("");
    setMsg("");

    try {
      const res = await fetch("/api/onboarding/send-sms-code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          full_name: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          shop_name: shopName.trim(),
          device_id: deviceId,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setSmsMsg(data?.error ?? "We could not send the SMS code.");
        return;
      }

      setSmsCooldown(Number(data?.resend_available_in ?? 45));
      setPhoneVerified(false);
      setSmsMsg(data?.dev_code ? `SMS code sent. Dev code: ${data.dev_code}` : data?.message ?? "SMS code sent. Check your phone for the 6-digit code.");
    } finally {
      setSmsBusy(false);
    }
  }

  async function verifySmsCode() {
    if (!smsCode.trim()) {
      setSmsMsg("Enter the 6-digit SMS code before verifying.");
      return;
    }

    setVerifySmsBusy(true);
    setSmsMsg("");

    try {
      const res = await fetch("/api/onboarding/verify-sms-code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), code: smsCode.trim() }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        const attemptsRemaining = Number(data?.attempts_remaining ?? -1);
        const suffix = attemptsRemaining >= 0 && data?.reason === "invalid_code" ? ` ${attemptsRemaining} attempt${attemptsRemaining === 1 ? "" : "s"} remaining.` : "";
        setSmsMsg(`${data?.error ?? "We could not verify that SMS code."}${suffix}`);
        return;
      }

      setPhoneVerified(true);
      setSmsMsg(data?.message ?? "Phone verified.");
    } finally {
      setVerifySmsBusy(false);
    }
  }

  async function saveAndContinue() {
    setBusy(true);
    setMsg("");

    try {
      const saved = await saveProfile();
      if (!saved) return;
      if (!saved.email_verified || !saved.phone_verified) {
        setMsg("Verify both your email and phone before moving to the company step.");
        return;
      }
      router.push("/onboarding/company");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 720 }}>
      <h1 style={{ margin: 0, fontSize: 30 }}>Welcome to RunBook</h1>

      <GlassCard title="Step 1 of 2 - Your Info">
        <div style={{ display: "grid", gap: 12 }}>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" style={{ padding: 10, borderRadius: 12 }} />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" autoComplete="email" style={{ padding: 10, borderRadius: 12 }} />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" autoComplete="tel" style={{ padding: 10, borderRadius: 12 }} />
          <input value={shopName} onChange={(e) => setShopName(e.target.value)} placeholder="Company / shop name" style={{ padding: 10, borderRadius: 12 }} />

          <div style={{ display: "grid", gap: 8, paddingTop: 4 }}>
            <div style={{ fontWeight: 900, fontSize: 13 }}>Email Verification</div>
            <div style={{ fontSize: 12, opacity: 0.78 }}>
              Use the same email tied to this account. We send a short code to confirm the trial belongs to a real person.
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <input value={emailCode} onChange={(e) => setEmailCode(e.target.value)} placeholder="Email code" style={{ padding: 10, borderRadius: 12, minWidth: 180 }} />
              <button onClick={sendEmailCode} disabled={emailBusy || loadingState || emailCooldown > 0} style={{ padding: "10px 14px", borderRadius: 12, fontWeight: 900 }}>
                {emailBusy ? "Sending..." : emailCooldown > 0 ? `Resend in ${emailCooldown}s` : "Send Email Code"}
              </button>
              <button onClick={verifyEmailCode} disabled={verifyEmailBusy || loadingState} style={{ padding: "10px 14px", borderRadius: 12, fontWeight: 900 }}>
                {verifyEmailBusy ? "Verifying..." : emailVerified ? "Verified" : "Verify Email"}
              </button>
            </div>
            {emailVerified ? <div style={{ fontSize: 12, opacity: 0.9 }}>Email verified successfully.</div> : null}
            {emailMsg ? <div style={{ fontSize: 12, opacity: 0.85 }}>{emailMsg}</div> : null}
          </div>

          <div style={{ display: "grid", gap: 8, paddingTop: 4 }}>
            <div style={{ fontWeight: 900, fontSize: 13 }}>Phone Verification</div>
            <div style={{ fontSize: 12, opacity: 0.78 }}>
              We also confirm your phone number to help prevent duplicate or abusive trial creation.
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <input value={smsCode} onChange={(e) => setSmsCode(e.target.value)} placeholder="SMS code" style={{ padding: 10, borderRadius: 12, minWidth: 180 }} />
              <button onClick={sendSmsCode} disabled={smsBusy || loadingState || smsCooldown > 0} style={{ padding: "10px 14px", borderRadius: 12, fontWeight: 900 }}>
                {smsBusy ? "Sending..." : smsCooldown > 0 ? `Resend in ${smsCooldown}s` : "Send SMS Code"}
              </button>
              <button onClick={verifySmsCode} disabled={verifySmsBusy || loadingState} style={{ padding: "10px 14px", borderRadius: 12, fontWeight: 900 }}>
                {verifySmsBusy ? "Verifying..." : phoneVerified ? "Verified" : "Verify Phone"}
              </button>
            </div>
            {phoneVerified ? <div style={{ fontSize: 12, opacity: 0.9 }}>Phone number verified successfully.</div> : null}
            {smsMsg ? <div style={{ fontSize: 12, opacity: 0.85 }}>{smsMsg}</div> : null}
          </div>

          <button onClick={saveAndContinue} disabled={busy || loadingState} style={{ padding: "10px 14px", borderRadius: 12, fontWeight: 900, width: "fit-content" }}>
            {busy ? "Saving..." : "Continue"}
          </button>

          {msg ? <div style={{ fontSize: 12, opacity: 0.85 }}>{msg}</div> : null}
        </div>
      </GlassCard>
    </div>
  );
}
