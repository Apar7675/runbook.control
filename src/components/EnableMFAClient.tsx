"use client";

import { useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { mfaStepUpHref, safeMfaReturnTo } from "@/lib/auth/mfaReturn";
import { discardTotpEnrollment, loadTotpEnrollmentState, startTotpEnrollment, verifyTotpEnrollment, type TotpEnrollment } from "@/lib/auth/mfaEnrollment";

type Props = { required?: boolean; returnTo?: string };

export default function EnableMFAClient({ required, returnTo }: Props) {
  const auth = supabaseBrowser().auth;
  const currentPage = typeof window !== "undefined" && typeof window.location.pathname === "string" ? window.location.pathname + (window.location.search ?? "") : "/settings";
  const destination = safeMfaReturnTo(returnTo ?? currentPage);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [pendingFactorIds, setPendingFactorIds] = useState<string[]>([]);
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("Loading authenticator settings...");
  const [busy, setBusy] = useState(false);
  const active = useRef(false);
  const epoch = useRef(0);
  const busyRef = useRef(false);
  const userRef = useRef<string | null>(null);
  const enrollmentRef = useRef<TotpEnrollment | null>(null);

  useEffect(() => {
    active.current = true;
    const generation = epoch.current;
    loadTotpEnrollmentState(auth).then((state) => {
      if (!active.current || generation !== epoch.current) return;
      userRef.current = state.userId;
      setUserId(state.userId);
      setEnabled(state.enabled);
      setPendingFactorIds(state.pendingFactorIds);
      setStatus(state.enabled ? "Authenticator enabled." : "Set up an authenticator app to continue.");
    }).catch((error: unknown) => {
      if (active.current && generation === epoch.current) setStatus(error instanceof Error ? error.message : "Authenticator settings could not be loaded.");
    });
    const { data: { subscription } } = auth.onAuthStateChange((_event, session) => {
      if (!active.current) return;
      if (_event !== "INITIAL_SESSION" || (userRef.current && session?.user.id !== userRef.current)) {
        epoch.current++;
        if (enrollmentRef.current) discardTotpEnrollment(enrollmentRef.current);
        enrollmentRef.current = null;
        userRef.current = null;
        busyRef.current = false;
        setEnrollment(null);
        setCode("");
        setEnabled(null);
        setUserId(null);
        setPendingFactorIds([]);
        setBusy(false);
        setStatus("The signed-in session changed. Reload before continuing.");
      }
    });
    return () => {
      active.current = false;
      epoch.current++;
      if (enrollmentRef.current) discardTotpEnrollment(enrollmentRef.current);
      enrollmentRef.current = null;
      subscription.unsubscribe();
    };
  }, [auth]);

  function valid(generation: number) { return active.current && generation === epoch.current; }
  function begin() {
    if (busyRef.current || !userId) return null;
    busyRef.current = true;
    setBusy(true);
    return epoch.current;
  }
  function finish(generation: number) {
    if (valid(generation)) { busyRef.current = false; setBusy(false); }
  }
  function showError(error: unknown, generation: number) {
    if (valid(generation)) setStatus(error instanceof Error ? error.message : "Authenticator setup failed.");
  }

  async function start() {
    const generation = begin();
    if (generation === null || !userId) return;
    setStatus("Starting authenticator setup...");
    try {
      const setup = await startTotpEnrollment(auth, userId, () => valid(generation));
      if (!valid(generation)) { discardTotpEnrollment(setup); return; }
      enrollmentRef.current = setup;
      setEnrollment(setup);
      setCode("");
      setStatus("Scan the QR code or enter the setup key, then enter the 6-digit code.");
    } catch (error: unknown) {
      showError(error, generation);
      // An interrupted/invalid provider response can still leave an unverified factor.
      try {
        if (!valid(generation)) return;
        const state = await loadTotpEnrollmentState(auth);
        if (valid(generation) && state.userId === userId) {
          setPendingFactorIds(state.pendingFactorIds);
          setEnabled(state.enabled);
        }
      } catch { /* Preserve the original error and let the user retry. */ }
    } finally { finish(generation); }
  }

  async function verify() {
    const setup = enrollmentRef.current;
    if (!setup) return;
    const generation = begin();
    if (generation === null) return;
    setStatus("Verifying authenticator...");
    try {
      await verifyTotpEnrollment(auth, setup, code.trim(), () => {
        if (!valid(generation)) return;
        enrollmentRef.current = null;
        setEnrollment(null);
        setCode("");
        setPendingFactorIds([]);
        setEnabled(true);
        setStatus("Authenticator enabled. Finalizing your session...");
      });
      if (valid(generation)) window.location.href = destination;
    } catch (error: unknown) { showError(error, generation); }
    finally { finish(generation); }
  }

  function closeSetup() {
    if (busyRef.current) return;
    if (enrollmentRef.current) discardTotpEnrollment(enrollmentRef.current);
    enrollmentRef.current = null;
    setEnrollment(null);
    setCode("");
    setStatus("Setup closed. Its unverified factor remains on your account. Contact your account administrator if setup is blocked.");
  }

  const button = { padding: 10, borderRadius: 8, fontWeight: 700 };
  return (
    <section aria-label="Authenticator setup" style={{ display: "grid", gap: 12, maxWidth: 560 }}>
      {required ? <p>Control administrators must verify an authenticator before opening admin pages.</p> : null}
      <h2 style={{ margin: 0, fontSize: 18 }}>Authenticator app</h2>
      {enrollment ? (
        <form onSubmit={(event) => { event.preventDefault(); void verify(); }} style={{ display: "grid", gap: 12 }}>
          {/* The provider QR contains a setup key. It stays in this component only. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={enrollment.qrImage} alt="Scan this QR code in your authenticator app" width={220} height={220} />
          <details><summary>Enter the setup key manually</summary><code style={{ overflowWrap: "anywhere" }}>{enrollment.secret}</code></details>
          <p>Verifying this new authenticator signs out your other RunBook sessions.</p>
          <label style={{ display: "grid", gap: 6 }}>6-digit authenticator code
            <input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} aria-describedby="mfa-enrollment-status" disabled={busy} />
          </label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="submit" disabled={busy || !/^\d{6}$/.test(code)} style={button}>{busy ? "Working..." : "Verify and continue"}</button>
            <button type="button" onClick={closeSetup} disabled={busy} style={button}>Close setup</button>
          </div>
        </form>
      ) : enabled ? (
        <button type="button" onClick={() => { window.location.href = mfaStepUpHref(destination); }} disabled={busy} style={button}>Verify now</button>
      ) : userId ? (
        <div style={{ display: "grid", gap: 8 }}>
          {pendingFactorIds.length > 0 ? <p>Earlier unfinished setup remains on this account. You can start a new setup. Contact your account administrator if the provider blocks further setup.</p> : null}
          <button type="button" onClick={() => void start()} disabled={busy} style={button}>Enable authenticator app</button>
        </div>
      ) : null}
      <div id="mfa-enrollment-status" role="status" aria-live="polite" style={{ overflowWrap: "anywhere" }}>{status}</div>
    </section>
  );
}
