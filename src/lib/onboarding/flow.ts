import { getShopSnapshot, getViewerContext, selectPrimaryShop } from "@/lib/control/summary";
import {
  getOnboardingState,
  getResolvedOnboardingPath,
  hasValidCompletionPrerequisites,
  markOnboardingComplete,
  type OnboardingState,
} from "@/lib/onboarding/state";
import { validateOnboardingState } from "@/lib/onboarding/validate";
import type { OnboardingValidationResult } from "@/lib/onboarding/validate";

export type SetupChecklist = {
  hasAdminEmployee: boolean;
  hasFirstWorkstation: boolean;
  systemReady: boolean;
  canLaunch: boolean;
  shopId: string | null;
  reasons: string[];
};

export type SetupStatus = {
  shopId: string | null;
  employee_count: number;
  workstation_count: number;
  onboarding_state: OnboardingState | null;
  validation_result: OnboardingValidationResult;
  billing_access_ok: boolean;
  system_ready: boolean;
  can_launch: boolean;
  reasons: string[];
};

export async function loadOnboardingStateForCurrentUser() {
  const context = await getViewerContext();
  const state = await getOnboardingState(context.userId);
  return { context, state };
}

export async function loadSetupChecklist(preferredShopId?: string | null): Promise<SetupChecklist> {
  const context = await getViewerContext();
  const state = await getOnboardingState(context.userId);
  const shopId = preferredShopId ?? state?.shop_id ?? null;
  if (!shopId) {
    return {
      hasAdminEmployee: false,
      hasFirstWorkstation: false,
      systemReady: false,
      canLaunch: false,
      shopId: null,
      reasons: ["Create your shop before entering setup."],
    };
  }

  const shop = selectPrimaryShop(context.shops, shopId);
  if (!shop) {
    return {
      hasAdminEmployee: false,
      hasFirstWorkstation: false,
      systemReady: false,
      canLaunch: false,
      shopId,
      reasons: ["This account can no longer access the onboarding shop."],
    };
  }

  const snapshot = await getShopSnapshot(shop);
  const hasAdminEmployee = snapshot.counts.employees_total > 0;
  const hasFirstWorkstation = snapshot.counts.workstations_total > 0;

  // Web onboarding validates data and app readiness only.
  // Desktop owns hardware-specific checks like RAM, disk, OS, and local workstation health.
  const systemReady =
    snapshot.access.desktop_mode === "full" &&
    snapshot.access.workstation_mode === "full" &&
    snapshot.health.offline_devices === 0;

  const reasons: string[] = [];
  if (!systemReady) {
    reasons.push("Review billing, app access, and device health before opening your shops.");
  }

  return {
    hasAdminEmployee,
    hasFirstWorkstation,
    systemReady,
    canLaunch: systemReady,
    shopId: shop.id,
    reasons,
  };
}

export async function loadSetupStatus(preferredShopId?: string | null): Promise<SetupStatus> {
  const context = await getViewerContext();
  const state = await getOnboardingState(context.userId);
  const shopId = preferredShopId ?? state?.shop_id ?? null;

  if (!shopId) {
    const validation = validateOnboardingState(state, { setupComplete: false });
    return {
      shopId: null,
      employee_count: 0,
      workstation_count: 0,
      onboarding_state: state,
      validation_result: validation,
      billing_access_ok: false,
      system_ready: false,
      can_launch: false,
      reasons: ["Create your shop before entering setup."],
    };
  }

  const shop = selectPrimaryShop(context.shops, shopId);
  if (!shop) {
    const validation = validateOnboardingState(state, { setupComplete: false });
    return {
      shopId,
      employee_count: 0,
      workstation_count: 0,
      onboarding_state: state,
      validation_result: validation,
      billing_access_ok: false,
      system_ready: false,
      can_launch: false,
      reasons: ["This account can no longer access the onboarding shop."],
    };
  }

  const snapshot = await getShopSnapshot(shop);
  const employeeCount = snapshot.counts.employees_total;
  const workstationCount = snapshot.counts.workstations_total;
  const hasAdminEmployee = employeeCount >= 1;
  const hasFirstWorkstation = workstationCount >= 1;

  // Web onboarding validates account and access readiness.
  // Desktop remains responsible for local hardware checks like OS, RAM, disk, and machine health.
  const billingAccessOk =
    snapshot.access.desktop_mode === "full" &&
    snapshot.access.workstation_mode === "full";

  const validation = validateOnboardingState(state, { setupComplete: billingAccessOk });
  const systemReady = validation.valid && billingAccessOk;

  const reasons: string[] = [];
  if (!systemReady) reasons.push("System not ready.");

  return {
    shopId: shop.id,
    employee_count: employeeCount,
    workstation_count: workstationCount,
    onboarding_state: state,
    validation_result: validation,
    billing_access_ok: billingAccessOk,
    system_ready: systemReady,
    can_launch: systemReady,
    reasons,
  };
}

export function requireOnboardingRoute(state: OnboardingState | null, expectedPath: string) {
  const resolved = getResolvedOnboardingPath(state);
  if (resolved === "/shops") return resolved;
  if (resolved !== expectedPath) return resolved;
  return null;
}

export async function resolveOnboardingPath(state: OnboardingState | null) {
  const basePath = getResolvedOnboardingPath(state);
  if (process.env.NODE_ENV === "development") {
    console.log("[Onboarding]", {
      action: "resolve_path:start",
      state,
      result: { basePath },
    });
  }
  if (basePath !== "/shops") {
    if (process.env.NODE_ENV === "development") {
      console.log("[Onboarding]", {
        action: "resolve_path:non_shops",
        state,
        result: { path: basePath },
      });
    }
    return basePath;
  }

  const validation = validateOnboardingState(state);
  if (!state || !validation.valid || !hasValidCompletionPrerequisites(state) || !state.completed_at) {
    const fallbackPath = getResolvedOnboardingPath(state);
    if (process.env.NODE_ENV === "development") {
      console.log("[Onboarding]", {
        action: "resolve_path:stale_completion",
        state,
        result: { path: fallbackPath, validation },
      });
    }
    return fallbackPath;
  }

  const checklist = await loadSetupChecklist(state.shop_id);
  const setupValidation = validateOnboardingState(state, { setupComplete: checklist.canLaunch });
  if (!checklist.canLaunch) {
    if (process.env.NODE_ENV === "development") {
      console.log("[Onboarding]", {
        action: "resolve_path:recovery_setup",
        state,
        result: { path: "/onboarding/setup", validation: setupValidation, checklist },
      });
    }
    return "/onboarding/setup";
  }

  if (process.env.NODE_ENV === "development") {
    console.log("[Onboarding]", {
      action: "resolve_path:complete",
      state,
      result: { path: "/shops", validation: setupValidation, checklist },
    });
  }
  return "/shops";
}

export async function resolveOnboardingPathForCurrentUser() {
  const { context, state } = await loadOnboardingStateForCurrentUser();
  const path = context.isPlatformAdmin ? "/shops" : await resolveOnboardingPath(state);
  return { context, state, path };
}

export async function requireOnboardingRouteForCurrentUser(expectedPath: string) {
  const { context, state, path } = await resolveOnboardingPathForCurrentUser();
  if (path === "/shops") return { context, state, redirectTo: path };
  if (path !== expectedPath) return { context, state, redirectTo: path };
  return { context, state, redirectTo: null as string | null };
}

export async function completeOnboardingForCurrentUser() {
  const { context, state, path } = await resolveOnboardingPathForCurrentUser();

  if (path === "/shops" && state?.completed_at) {
    if (process.env.NODE_ENV === "development") {
      console.log("[Onboarding]", {
        action: "complete:idempotent",
        state,
        result: { ok: true, path },
      });
    }
    return { ok: true as const, state };
  }

  const status = await loadSetupStatus(state?.shop_id ?? null);

  if (!state?.shop_id || !status.shopId) {
    return { ok: false as const, error: "Create your shop before completing onboarding." };
  }
  if (state.shop_id !== status.shopId) {
    return { ok: false as const, error: "Onboarding shop context is out of date. Refresh and try again." };
  }
  if (!status.can_launch) {
    if (process.env.NODE_ENV === "development") {
      console.log("[Onboarding]", {
        action: "complete:blocked",
        state,
        result: { ok: false, error: status.reasons[0] ?? "Finish setup before launching into shops." },
      });
    }
    return { ok: false as const, error: status.reasons[0] ?? "Finish setup before launching into shops." };
  }

  const next = await markOnboardingComplete({ userId: context.userId, shopId: status.shopId });
  if (process.env.NODE_ENV === "development") {
    console.log("[Onboarding]", {
      action: "complete:success",
      state,
      result: next,
    });
  }
  return { ok: true as const, state: next };
}
