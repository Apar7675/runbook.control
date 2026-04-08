import { supabaseAdmin } from "@/lib/supabase/admin";
import { validateOnboardingState } from "@/lib/onboarding/validate";
import {
  EMAIL_CODE_TTL_MS,
  SMS_CODE_TTL_MS,
  hashIdentityValue,
  hashVerificationCode,
  normalizeEmail,
  normalizePhone,
  timingSafeEqualHex,
} from "@/lib/onboarding/identity";

export type OnboardingStep = "profile" | "company" | "setup" | "complete";

export type OnboardingState = {
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  shop_name: string;
  device_id: string | null;
  email_verified: boolean;
  phone_verified: boolean;
  email_verified_at: string | null;
  phone_verified_at: string | null;
  current_step: OnboardingStep;
  completed_steps: string[];
  completed_at: string | null;
  shop_id: string | null;
  last_seen_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

const STATE_TABLE = "rb_onboarding_state";
const CODE_TABLE = "rb_onboarding_codes";
const MAX_VERIFY_ATTEMPTS = 5;
export const RESEND_COOLDOWN_SECONDS = 45;

function nowIso() {
  return new Date().toISOString();
}

function ttlForChannel(channel: "email" | "sms") {
  return channel === "email" ? EMAIL_CODE_TTL_MS : SMS_CODE_TTL_MS;
}

function normalizeCompletedSteps(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry ?? "").trim()).filter(Boolean);
}

function hasVerifiedProfile(state: Partial<OnboardingState>) {
  return Boolean(state.full_name && state.email && state.phone && state.shop_name && state.email_verified && state.phone_verified);
}

export function hasValidCompletionPrerequisites(state: Partial<OnboardingState>) {
  return Boolean(hasVerifiedProfile(state) && state.shop_id);
}

function deriveProgress(state: Partial<OnboardingState>) {
  const completedSteps: string[] = [];
  const hasCompletionPrereqs = hasValidCompletionPrerequisites(state);

  if (hasVerifiedProfile(state)) completedSteps.push("profile");
  if (state.shop_id) completedSteps.push("company");

  let completedAt = state.completed_at ?? null;
  if (!hasCompletionPrereqs) completedAt = null;

  if (completedAt) completedSteps.push("setup");

  const currentStep: OnboardingStep = completedAt && hasCompletionPrereqs
    ? "complete"
    : !hasVerifiedProfile(state)
    ? "profile"
    : !state.shop_id
    ? "company"
    : "setup";

  return {
    current_step: currentStep,
    completed_steps: completedSteps,
    completed_at: completedAt,
  };
}

function mapStateRow(data: any): OnboardingState {
  return {
    user_id: String(data.user_id),
    full_name: String(data.full_name ?? ""),
    email: String(data.email ?? ""),
    phone: String(data.phone ?? ""),
    shop_name: String(data.shop_name ?? ""),
    device_id: data.device_id ? String(data.device_id) : null,
    email_verified: Boolean(data.email_verified),
    phone_verified: Boolean(data.phone_verified),
    email_verified_at: data.email_verified_at ?? null,
    phone_verified_at: data.phone_verified_at ?? null,
    current_step: (String(data.current_step ?? "profile") as OnboardingStep) || "profile",
    completed_steps: normalizeCompletedSteps(data.completed_steps),
    completed_at: data.completed_at ?? null,
    shop_id: data.shop_id ? String(data.shop_id) : null,
    last_seen_at: data.last_seen_at ?? null,
    created_at: data.created_at ?? null,
    updated_at: data.updated_at ?? null,
  };
}

export function getResolvedOnboardingPath(state: OnboardingState | null) {
  if (!state) return "/onboarding/profile";
  const validation = validateOnboardingState(state);
  if (state.completed_at && validation.valid && hasValidCompletionPrerequisites(state)) return "/onboarding/complete";
  if (state.current_step === "company") return "/onboarding/company";
  if (state.current_step === "setup") return "/onboarding/setup";
  return "/onboarding/profile";
}

export async function getOnboardingState(userId: string) {
  const admin = supabaseAdmin();
  const { data, error } = await admin.from(STATE_TABLE).select("*").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapStateRow(data) : null;
}

export async function upsertOnboardingState(userId: string, patch: Partial<OnboardingState>) {
  const admin = supabaseAdmin();
  const existing = await getOnboardingState(userId);
  const nextEmail = patch.email !== undefined ? normalizeEmail(patch.email) : existing?.email ?? "";
  const nextPhone = patch.phone !== undefined ? normalizePhone(patch.phone) : existing?.phone ?? "";
  const completedAt = patch.completed_at !== undefined ? patch.completed_at : existing?.completed_at ?? null;

  const draft: Partial<OnboardingState> = {
    user_id: userId,
    full_name: patch.full_name !== undefined ? String(patch.full_name ?? "").trim() : existing?.full_name ?? "",
    email: nextEmail,
    phone: nextPhone,
    shop_name: patch.shop_name !== undefined ? String(patch.shop_name ?? "").trim() : existing?.shop_name ?? "",
    device_id:
      patch.device_id !== undefined
        ? String(patch.device_id ?? "").trim() || null
        : existing?.device_id ?? null,
    email_verified:
      patch.email_verified !== undefined
        ? Boolean(patch.email_verified)
        : existing && existing.email === nextEmail
        ? existing.email_verified
        : false,
    phone_verified:
      patch.phone_verified !== undefined
        ? Boolean(patch.phone_verified)
        : existing && existing.phone === nextPhone
        ? existing.phone_verified
        : false,
    email_verified_at:
      patch.email_verified_at !== undefined
        ? patch.email_verified_at
        : existing && existing.email === nextEmail
        ? existing.email_verified_at
        : null,
    phone_verified_at:
      patch.phone_verified_at !== undefined
        ? patch.phone_verified_at
        : existing && existing.phone === nextPhone
        ? existing.phone_verified_at
        : null,
    shop_id:
      patch.shop_id !== undefined
        ? patch.shop_id
        : existing?.shop_id ?? null,
    completed_at: completedAt,
    last_seen_at: nowIso(),
    updated_at: nowIso(),
    created_at: existing?.created_at ?? nowIso(),
  };

  const progress = deriveProgress(draft);

  const payload = {
    user_id: userId,
    full_name: draft.full_name ?? "",
    email: draft.email ?? "",
    phone: draft.phone ?? "",
    shop_name: draft.shop_name ?? "",
    device_id: draft.device_id ?? null,
    email_verified: Boolean(draft.email_verified),
    phone_verified: Boolean(draft.phone_verified),
    email_verified_at: draft.email_verified_at ?? null,
    phone_verified_at: draft.phone_verified_at ?? null,
    current_step: progress.current_step,
    completed_steps: progress.completed_steps,
    completed_at: progress.completed_at,
    shop_id: draft.shop_id ?? null,
    last_seen_at: draft.last_seen_at ?? nowIso(),
    updated_at: draft.updated_at ?? nowIso(),
    created_at: draft.created_at ?? nowIso(),
  };

  const { data, error } = await admin
    .from(STATE_TABLE)
    .upsert(payload, { onConflict: "user_id" })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return mapStateRow(data);
}

export async function markOnboardingComplete(args: { userId: string; shopId: string }) {
  return upsertOnboardingState(args.userId, {
    shop_id: args.shopId,
    completed_at: nowIso(),
  });
}

export async function issueVerificationCode(args: {
  userId: string;
  channel: "email" | "sms";
  destination: string;
  code: string;
}) {
  const admin = supabaseAdmin();
  const destination =
    args.channel === "email" ? normalizeEmail(args.destination) : normalizePhone(args.destination);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlForChannel(args.channel));
  const { data: existing, error: existingError } = await admin
    .from(CODE_TABLE)
    .select("sent_count,last_sent_at")
    .eq("user_id", args.userId)
    .eq("channel", args.channel)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);

  const resendAvailableIn = existing?.last_sent_at
    ? Math.max(
        0,
        RESEND_COOLDOWN_SECONDS - Math.floor((Date.now() - new Date(existing.last_sent_at).getTime()) / 1000)
      )
    : 0;

  if (resendAvailableIn > 0) {
    throw new Error(`Please wait ${resendAvailableIn}s before requesting another ${args.channel === "email" ? "email" : "SMS"} code.`);
  }

  const { error } = await admin.from(CODE_TABLE).upsert(
    {
      user_id: args.userId,
      channel: args.channel,
      destination,
      destination_hash: hashIdentityValue(destination),
      code_hash: hashVerificationCode({
        channel: args.channel,
        userId: args.userId,
        destination,
        code: args.code,
      }),
      expires_at: expiresAt.toISOString(),
      verified_at: null,
      attempts: 0,
      sent_count: Number(existing?.sent_count ?? 0) + 1,
      last_sent_at: now.toISOString(),
      updated_at: now.toISOString(),
    },
    { onConflict: "user_id,channel" }
  );

  if (error) throw new Error(error.message);
  return { expires_at: expiresAt.toISOString(), resend_available_in: RESEND_COOLDOWN_SECONDS };
}

export async function verifyStoredCode(args: {
  userId: string;
  channel: "email" | "sms";
  destination: string;
  code: string;
}) {
  const admin = supabaseAdmin();
  const destination =
    args.channel === "email" ? normalizeEmail(args.destination) : normalizePhone(args.destination);

  const { data, error } = await admin
    .from(CODE_TABLE)
    .select("*")
    .eq("user_id", args.userId)
    .eq("channel", args.channel)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return { ok: false as const, reason: "not_requested" as const, error: "Request a verification code first." };
  if (data.verified_at) return { ok: true as const, alreadyVerified: true as const };
  if (String(data.destination ?? "") !== destination) {
    return {
      ok: false as const,
      reason: "destination_changed" as const,
      error: "Your verification destination changed. Request a new code for the latest contact info.",
    };
  }
  if (!data.expires_at || new Date(data.expires_at).getTime() < Date.now()) {
    return {
      ok: false as const,
      reason: "expired" as const,
      error: "That code expired. Request a new one and try again.",
    };
  }
  if (Number(data.attempts ?? 0) >= MAX_VERIFY_ATTEMPTS) {
    return {
      ok: false as const,
      reason: "too_many_attempts" as const,
      error: "Too many incorrect attempts. Request a new code to continue.",
      attempts_remaining: 0,
    };
  }

  const actualHash = hashVerificationCode({
    channel: args.channel,
    userId: args.userId,
    destination,
    code: args.code,
  });

  if (!timingSafeEqualHex(String(data.code_hash ?? ""), actualHash)) {
    const attempts = Number(data.attempts ?? 0) + 1;
    await admin
      .from(CODE_TABLE)
      .update({ attempts, updated_at: nowIso() })
      .eq("id", data.id);
    return {
      ok: false as const,
      reason: attempts >= MAX_VERIFY_ATTEMPTS ? "too_many_attempts" as const : "invalid_code" as const,
      error:
        attempts >= MAX_VERIFY_ATTEMPTS
          ? "Too many incorrect attempts. Request a new code to continue."
          : "That code does not match. Double-check the 6 digits and try again.",
      attempts_remaining: Math.max(0, MAX_VERIFY_ATTEMPTS - attempts),
    };
  }

  await admin
    .from(CODE_TABLE)
    .update({ verified_at: nowIso(), updated_at: nowIso() })
    .eq("id", data.id);

  return { ok: true as const, alreadyVerified: false as const };
}

export async function findTrialReuseRisk(args: {
  deviceId?: string | null;
  emailHash?: string | null;
  phoneHash?: string | null;
}) {
  const admin = supabaseAdmin();

  if (args.deviceId) {
    const { data, error } = await admin.from("rb_shops").select("id,name").eq("trial_device_id", args.deviceId).limit(1).maybeSingle();
    if (error) throw new Error(error.message);
    if (data?.id) return { field: "device_id" as const, shop_id: data.id as string, shop_name: String(data.name ?? "") };
  }

  if (args.emailHash) {
    const { data, error } = await admin.from("rb_shops").select("id,name").eq("trial_email_hash", args.emailHash).limit(1).maybeSingle();
    if (error) throw new Error(error.message);
    if (data?.id) return { field: "email" as const, shop_id: data.id as string, shop_name: String(data.name ?? "") };
  }

  if (args.phoneHash) {
    const { data, error } = await admin.from("rb_shops").select("id,name").eq("trial_phone_hash", args.phoneHash).limit(1).maybeSingle();
    if (error) throw new Error(error.message);
    if (data?.id) return { field: "phone" as const, shop_id: data.id as string, shop_name: String(data.name ?? "") };
  }

  return null;
}
