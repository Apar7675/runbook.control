import type { SupabaseClient } from "@supabase/supabase-js";

type Auth = SupabaseClient["auth"];
export type TotpEnrollment = { factorId: string; userId: string; qrImage: string; secret: string };

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
  return {
    userId,
    enabled: (data?.totp ?? []).some((factor) => factor.status === "verified"),
    pendingFactorIds: (data?.all ?? []).filter((factor) => factor.factor_type === "totp" && factor.status === "unverified").map((factor) => factor.id),
  };
}

export async function startTotpEnrollment(auth: Auth, expectedUserId: string): Promise<TotpEnrollment> {
  await currentUser(auth, expectedUserId);
  const { data: factors, error: factorsError } = await auth.mfa.listFactors();
  if (factorsError) throw new Error(factorsError.message);
  if ((factors?.totp ?? []).some((factor) => factor.status === "verified")) {
    throw new Error("An authenticator is already enabled. Verify it to continue.");
  }
  if ((factors?.all ?? []).some((factor) => factor.factor_type === "totp" && factor.status === "unverified")) {
    throw new Error("An unfinished authenticator setup exists. Reload and cancel it before starting again.");
  }
  await currentUser(auth, expectedUserId);
  const { data, error } = await auth.mfa.enroll({ factorType: "totp", friendlyName: "RunBook Control" });
  if (error) throw new Error(error.message);
  if (!data || data.type !== "totp" || !data.id || !data.totp?.qr_code || !data.totp.secret) {
    throw new Error("Authenticator setup did not return a QR code and setup key.");
  }
  await currentUser(auth, expectedUserId);
  return { factorId: data.id, userId: expectedUserId, qrImage: qrImage(data.totp.qr_code), secret: data.totp.secret };
}

export async function verifyTotpEnrollment(auth: Auth, enrollment: TotpEnrollment, code: string, onVerified: () => void = () => {}) {
  if (!/^\d{6}$/.test(code)) throw new Error("Enter the 6-digit code from your authenticator app.");
  await currentUser(auth, enrollment.userId);
  const { data: challenge, error: challengeError } = await auth.mfa.challenge({ factorId: enrollment.factorId });
  if (challengeError) throw new Error(challengeError.message);
  if (!challenge?.id) throw new Error("Authenticator challenge is unavailable.");
  const { error: verifyError } = await auth.mfa.verify({ factorId: enrollment.factorId, challengeId: challenge.id, code });
  if (verifyError) throw new Error(verifyError.message);
  // A verified factor is no longer cancelable setup. Clear its QR/key immediately.
  onVerified();
  await currentUser(auth, enrollment.userId);
  const { error: refreshError } = await auth.refreshSession();
  if (refreshError) throw new Error("Authenticator enabled, but session refresh failed. Verify it again to continue.");
  await currentUser(auth, enrollment.userId);
  const { data: assurance, error: assuranceError } = await auth.mfa.getAuthenticatorAssuranceLevel();
  if (assuranceError) throw new Error(assuranceError.message);
  if (assurance?.currentLevel !== "aal2") throw new Error("Authenticator enabled, but an AAL2 session was not established. Verify it again to continue.");
}

export async function cancelTotpEnrollment(auth: Auth, enrollment: TotpEnrollment) {
  await currentUser(auth, enrollment.userId);
  const { data, error } = await auth.mfa.listFactors();
  if (error) throw new Error(error.message);
  const factor = (data?.all ?? []).find((item) => item.id === enrollment.factorId);
  if (!factor) return; // Already removed; never substitute or remove another factor.
  if (factor.factor_type !== "totp" || factor.status !== "unverified") {
    throw new Error("This authenticator is already enabled and cannot be canceled as unfinished setup.");
  }
  await currentUser(auth, enrollment.userId);
  const { error: cancelError } = await auth.mfa.unenroll({ factorId: enrollment.factorId });
  if (cancelError) throw new Error(cancelError.message);
}
