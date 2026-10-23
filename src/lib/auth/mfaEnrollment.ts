import type { SupabaseClient } from "@supabase/supabase-js";
import { captureMfaFlow, type BoundMfaFlow } from "@/lib/auth/mfaSession";

type Auth = SupabaseClient["auth"];
export type TotpEnrollment = { factorId: string; userId: string; qrImage: string; secret: string };
const enrollmentFlows = new WeakMap<TotpEnrollment, BoundMfaFlow>();

async function currentUser(auth: Auth, expectedUserId?: string): Promise<string> {
  const { data, error } = await auth.getUser();
  if (error) throw new Error(error.message);
  if (!data.user?.id || data.user.is_anonymous) throw new Error("Sign in before setting up an authenticator.");
  if (expectedUserId && data.user.id !== expectedUserId) throw new Error("The signed-in account changed. Reload before continuing.");
  return data.user.id;
}

function qrImage(qr: string): string {
  const prefix = "data:image/svg+xml;utf-8,";
  let svg = qr.startsWith(prefix) ? qr.slice(prefix.length) : qr;
  if (!svg.trimStart().startsWith("<")) {
    try { svg = decodeURIComponent(svg); } catch { throw new Error("Authenticator QR code is unavailable."); }
  }
  if (!/^\s*(?:<\?xml[^>]*>\s*)?<svg[\s>]/i.test(svg)) throw new Error("Authenticator QR code is unavailable.");
  return prefix + encodeURIComponent(svg);
}

export async function loadTotpEnrollmentState(auth: Auth) {
  const userId = await currentUser(auth);
  const { data, error } = await auth.mfa.listFactors();
  if (error) throw new Error(error.message);
  await currentUser(auth, userId);
  const verifiedFactorId = (data?.totp ?? []).find((factor) => factor.status === "verified")?.id ?? null;
  return {
    userId,
    enabled: verifiedFactorId !== null,
    verifiedFactorId,
    pendingFactorIds: (data?.all ?? []).filter((factor) => factor.factor_type === "totp" && factor.status === "unverified").map((factor) => factor.id),
  };
}

export async function startTotpEnrollment(auth: Auth, expectedUserId: string, isCurrent: () => boolean): Promise<TotpEnrollment> {
  const flow = await captureMfaFlow(auth, expectedUserId, isCurrent);
  let retained = false;
  try {
    flow.assertCurrent();
    const { data: factors, error: factorsError } = await flow.auth.mfa.listFactors();
    flow.assertCurrent();
    if (factorsError) throw new Error(factorsError.message);
    if ((factors?.totp ?? []).some((factor) => factor.status === "verified")) throw new Error("An authenticator is already enabled. Verify it to continue.");
    const { data, error } = await flow.auth.mfa.enroll({ factorType: "totp", friendlyName: "RunBook Control " + crypto.randomUUID() });
    flow.assertCurrent();
    if (error) throw new Error(error.message);
    if (!data || data.type !== "totp" || !data.id || !data.totp?.qr_code || !data.totp.secret) throw new Error("Authenticator setup did not return a QR code and setup key.");
    const enrollment = { factorId: data.id, userId: expectedUserId, qrImage: qrImage(data.totp.qr_code), secret: data.totp.secret };
    enrollmentFlows.set(enrollment, flow);
    retained = true;
    return enrollment;
  } finally {
    if (!retained) flow.dispose();
  }
}

async function verifyBoundTotp(flow: BoundMfaFlow, factorId: string, code: string, onVerified: () => void) {
  if (!/^\d{6}$/.test(code)) throw new Error("Enter the 6-digit code from your authenticator app.");
  flow.assertCurrent();
  const { data: challenge, error: challengeError } = await flow.auth.mfa.challenge({ factorId });
  flow.assertCurrent();
  if (challengeError) throw new Error(challengeError.message);
  if (!challenge?.id) throw new Error("Authenticator challenge is unavailable.");
  const { data: verified, error: verifyError } = await flow.auth.mfa.verify({ factorId, challengeId: challenge.id, code });
  if (verifyError) throw new Error(verifyError.message);
  // Do this even if the operation retired while verification was in flight.
  onVerified();
  flow.assertCurrent();
  if (!verified?.access_token || !verified.refresh_token) throw new Error("Authenticator verified, but no session was returned. Sign in again.");
  await flow.promote({ access_token: verified.access_token, refresh_token: verified.refresh_token });
  flow.assertCurrent();
}

export async function verifyTotpEnrollment(_auth: Auth, enrollment: TotpEnrollment, code: string, onVerified: () => void = () => {}) {
  const flow = enrollmentFlows.get(enrollment);
  if (!flow) throw new Error("This authenticator setup is no longer active. Reload before continuing.");
  let verified = false;
  try {
    await verifyBoundTotp(flow, enrollment.factorId, code, () => { verified = true; onVerified(); });
  } finally {
    if (verified) discardTotpEnrollment(enrollment);
  }
}

export async function verifyExistingTotp(auth: Auth, userId: string, factorId: string, code: string, isCurrent: () => boolean) {
  if (!/^\d{6}$/.test(code)) throw new Error("Enter a valid 6-digit code.");
  const flow = await captureMfaFlow(auth, userId, isCurrent);
  try {
    flow.assertCurrent();
    const { data: factors, error } = await flow.auth.mfa.listFactors();
    flow.assertCurrent();
    if (error) throw new Error(error.message);
    if (!(factors?.totp ?? []).some((factor) => factor.id === factorId && factor.status === "verified")) throw new Error("The selected authenticator is unavailable. Reload before continuing.");
    await verifyBoundTotp(flow, factorId, code, () => {});
  } finally {
    flow.dispose();
  }
}

/** Close local setup only. Provider factor deletion has no atomic unverified-only API. */
export function discardTotpEnrollment(enrollment: TotpEnrollment) {
  enrollmentFlows.get(enrollment)?.dispose();
  enrollmentFlows.delete(enrollment);
}
