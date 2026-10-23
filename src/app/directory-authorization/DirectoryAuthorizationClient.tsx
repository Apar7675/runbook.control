"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import ControlActionButton from "@/components/control/ControlActionButton";
import ControlPanel from "@/components/control/ControlPanel";
import { controlTheme as t } from "@/components/control/controlTheme";
import { supabaseBrowser } from "@/lib/supabase/client";
import { parseDirectoryReview, type DirectoryReview } from "@/lib/business/directoryAccessReview";

const input: CSSProperties = { width: "100%", boxSizing: "border-box", minHeight: 38, padding: 10, borderRadius: t.radius.sm,
  border: `1px solid ${t.color.softBorder}`, background: t.color.appBg, color: t.color.text };

export default function DirectoryAuthorizationClient({ expectedUserId }: { expectedUserId: string }) {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const accountChanged = useRef(false);
  const [factor, setFactor] = useState("");
  const [qr, setQr] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Loading authenticator status…");
  const [session, setSession] = useState("");
  const [text, setText] = useState("");
  const [review, setReview] = useState<DirectoryReview | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const invalidateAccount = useCallback(() => {
    accountChanged.current = true; setBlocked(true); setFactor(""); setQr(""); setCode("");
    setSession(""); setText(""); setReview(null); setConfirmed(false);
    setStatus("The signed-in account changed. Reload this page before continuing.");
  }, []);
  const requireCurrentAccount = useCallback(async () => {
    if (accountChanged.current) throw new Error("Account changed");
    const { data, error } = await supabase.auth.getUser();
    if (accountChanged.current || error || data.user?.id !== expectedUserId || data.user.is_anonymous === true) {
      invalidateAccount(); throw new Error("Account changed");
    }
  }, [supabase, expectedUserId, invalidateAccount]);

  useEffect(() => {
    let active = true;
    const subscription = supabase.auth.onAuthStateChange((_event, current) => {
      if (active && current?.user.id !== expectedUserId) invalidateAccount();
    });
    void requireCurrentAccount().then(() => supabase.auth.mfa.listFactors()).then(async ({ data, error }) => {
      if (!active) return;
      await requireCurrentAccount();
      const existing = data?.totp.find(f => f.status === "verified");
      setFactor(existing?.id ?? "");
      setStatus(error ? "Authenticator status is unavailable. Reload to retry." : existing ? "Verify your existing authenticator." : "Set up an authenticator to review directory access.");
    }).catch(() => { if (active && !accountChanged.current) setStatus("Authenticator status is unavailable. Reload to retry."); });
    return () => { active = false; subscription.data.subscription.unsubscribe(); };
  }, [supabase, expectedUserId, invalidateAccount, requireCurrentAccount]);

  async function enroll() {
    setBusy(true); setSession("");
    try {
      await requireCurrentAccount();
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "RunBook directory access" });
      await requireCurrentAccount();
      if (error || !data || data.totp.qr_code.length > 65536 || !data.totp.qr_code.startsWith("data:image/svg+xml;utf-8,")) throw new Error();
      setFactor(data.id); setQr(data.totp.qr_code);
      setStatus("Scan the QR code with your authenticator, then enter its code. Keep the QR code private.");
    } catch { if (!accountChanged.current) setStatus("Authenticator setup failed. Your directory permissions have not changed."); }
    finally { setBusy(false); }
  }

  async function verify() {
    setBusy(true); setSession("");
    try {
      await requireCurrentAccount();
      const challenge = await supabase.auth.mfa.challenge({ factorId: factor });
      await requireCurrentAccount();
      if (challenge.error || !challenge.data) throw new Error();
      const result = await supabase.auth.mfa.verify({ factorId: factor, challengeId: challenge.data.id, code });
      setCode("");
      await requireCurrentAccount();
      if (result.error) throw new Error();
      setQr("");
      const refreshed = await supabase.auth.refreshSession();
      await requireCurrentAccount();
      if (refreshed.error) throw new Error();
      const response = await fetch("/api/control/directory-session", { credentials: "same-origin", cache: "no-store" });
      const metadata = await response.json();
      await requireCurrentAccount();
      if (!response.ok || metadata.ok !== true || metadata.user_id !== expectedUserId || metadata.assurance !== "aal2") throw new Error();
      // Deliberate public fields only: never serialize a Supabase session/token.
      setSession(JSON.stringify({ user_id: metadata.user_id, session_id: metadata.session_id,
        expires_utc: metadata.expires_utc, assurance: metadata.assurance }, null, 2));
      setStatus("Authenticator verified. If you just enabled MFA, sign in again in Desktop before preparing its directory review. Directory access still requires the delegated operation below.");
    } catch { setCode(""); if (!accountChanged.current) setStatus("Verification failed or expired. Enter a fresh authenticator code to retry."); }
    finally { setBusy(false); }
  }

  async function submit() {
    if (!review || !confirmed) return;
    setBusy(true); setConfirmed(false);
    try {
      await requireCurrentAccount();
      const response = await fetch("/api/control/directory-lease-approvals", { method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(review) });
      const result = await response.json();
      await requireCurrentAccount();
      if (!response.ok || result.ok !== true) throw new Error();
      setStatus("The reviewed directory access operation completed. Reopen Customers & Vendors in Desktop.");
      setReview(null); setText("");
    } catch { if (!accountChanged.current) setStatus("Access was not confirmed. Check the current lease receipt before retrying the same request; delegation, MFA or validity may be unavailable."); }
    finally { setBusy(false); }
  }

  return <main style={{ display: "grid", gap: 18, maxWidth: 900, margin: "32px auto", padding: 18 }}>
    <div><p style={{ color: t.color.textMuted }}>RunBook Control</p><h1>Customers & Vendors access</h1>
      <p>Review access for an existing company and Desktop. Customer and vendor records stay in your local RunBook company folder.</p></div>
    <ControlPanel title="Verify your account" description="Use your own authenticator. Verification does not grant platform-admin access or enable other modules.">
      <p>Enabling a new authenticator signs out your other RunBook sessions. Sign in again in Desktop afterward.</p>
      {!factor ? <ControlActionButton onClick={enroll} disabled={busy || blocked}>Set up authenticator</ControlActionButton> : null}
      {qr ? <img src={qr} width={240} height={240} alt="Private authenticator enrollment QR code" /> : null}
      {factor ? <><label htmlFor="directory-code">Authenticator code</label><input id="directory-code" style={input} value={code}
        onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" disabled={busy || blocked} />
        <ControlActionButton onClick={verify} disabled={busy || blocked || code.length !== 6}>Verify authenticator</ControlActionButton></> : null}
      <p role="status" aria-live="polite">{status}</p>
      {session ? <details><summary>Public session identity for the activation review</summary><pre style={{ overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>{session}</pre></details> : null}
    </ControlPanel>
    <ControlPanel title="Review a directory operation" description="Paste the public activation review prepared for this company. The server independently checks current ownership, delegation, MFA, entitlement, device and company binding.">
      <label htmlFor="directory-review">Public directory review JSON</label><textarea id="directory-review" style={{ ...input, minHeight: 160 }} value={text} disabled={busy || blocked}
        onChange={e => { setText(e.target.value); setReview(null); setConfirmed(false); }} maxLength={8192} spellCheck={false} />
      <ControlActionButton disabled={busy || blocked || !text} onClick={() => { try { setReview(parseDirectoryReview(text)); setConfirmed(false); } catch { setReview(null); setStatus("The review is invalid or contains unsupported fields. Ask for a corrected public review."); } }}>Preview operation</ControlActionButton>
      {review ? <><dl style={{ overflowWrap: "anywhere" }}>{Object.entries(review).map(([key, value]) => <div key={key}><dt>{key.replaceAll("_", " ")}</dt><dd>{String(value)}</dd></div>)}</dl>
        <label><input type="checkbox" checked={confirmed} disabled={busy || blocked} onChange={e => setConfirmed(e.target.checked)} /> I reviewed this exact company, device, operation and validity period.</label>
        <ControlActionButton tone={review.action === "revoke" ? "danger" : "primary"} disabled={busy || blocked || !confirmed} onClick={submit}>Confirm {review.action} of {review.capability_code}</ControlActionButton></> : null}
    </ControlPanel>
  </main>;
}
