import type { OnboardingState } from "@/lib/onboarding/state";

export type OnboardingValidationResult =
  | { valid: true; reason: "OK" }
  | { valid: false; reason: "STALE_COMPLETION" };

type ValidateOptions = {
  setupComplete?: boolean;
};

function hasVerifiedProfile(state: OnboardingState | null) {
  if (!state) return false;
  return Boolean(state.full_name && state.email && state.phone && state.shop_name && state.email_verified && state.phone_verified);
}

export function validateOnboardingState(state: OnboardingState | null, options: ValidateOptions = {}): OnboardingValidationResult {
  if (!state?.completed_at) {
    return { valid: true, reason: "OK" };
  }

  if (!state.shop_id || !hasVerifiedProfile(state) || options.setupComplete === false) {
    return { valid: false, reason: "STALE_COMPLETION" };
  }

  return { valid: true, reason: "OK" };
}
