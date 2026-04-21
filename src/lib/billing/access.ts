import type { ShopEntitlement } from "@/lib/billing/entitlement";

export type ShopAccessState = "trialing" | "active" | "grace" | "restricted" | "expired";
export type ShopDisplayStatus = "Free Trial" | "Active" | "Payment Needed" | "Restricted" | "Expired";
export type DesktopAccessMode = "full" | "read_only" | "blocked";
export type MobileAccessMode = "full" | "queue_only" | "blocked";
export type WorkstationAccessMode = "full" | "blocked";

export type ShopAccessDecision = {
  state: ShopAccessState;
  display_status: ShopDisplayStatus;
  summary: string;
  reason: string;
  billing_status: ShopEntitlement["status"];
  allowed: boolean;
  restricted: boolean;
  grace_active: boolean;
  desktop_mode: DesktopAccessMode;
  mobile_mode: MobileAccessMode;
  workstation_mode: WorkstationAccessMode;
};

export function describeShopAccess(entitlement: ShopEntitlement): ShopAccessDecision {
  if (
    (entitlement.status === "trialing" || entitlement.status === "trial_active" || entitlement.status === "trial_extended") &&
    entitlement.allowed &&
    !entitlement.restricted
  ) {
    return {
      state: "trialing",
      display_status: "Free Trial",
      summary: "Shop access is active during the free trial.",
      reason: entitlement.reason,
      billing_status: entitlement.status,
      allowed: entitlement.allowed,
      restricted: entitlement.restricted,
      grace_active: entitlement.grace_active,
      desktop_mode: "full",
      mobile_mode: "full",
      workstation_mode: "full",
    };
  }

  if ((entitlement.status === "active" || entitlement.status === "paid_active") && entitlement.allowed && !entitlement.restricted) {
    return {
      state: "active",
      display_status: "Active",
      summary: "Shop access is active.",
      reason: entitlement.reason,
      billing_status: entitlement.status,
      allowed: entitlement.allowed,
      restricted: entitlement.restricted,
      grace_active: entitlement.grace_active,
      desktop_mode: "full",
      mobile_mode: "full",
      workstation_mode: "full",
    };
  }

  if (entitlement.status === "payment_required") {
    return {
      state: "restricted",
      display_status: "Payment Needed",
      summary: "Payment is required before full shop access can continue.",
      reason: entitlement.reason,
      billing_status: entitlement.status,
      allowed: entitlement.allowed,
      restricted: entitlement.restricted,
      grace_active: entitlement.grace_active,
      desktop_mode: "read_only",
      mobile_mode: "queue_only",
      workstation_mode: "blocked",
    };
  }

  if (entitlement.status === "trial_ended") {
    return {
      state: "expired",
      display_status: "Expired",
      summary: "The manual trial state has ended. Billing must be restored before full access returns.",
      reason: entitlement.reason,
      billing_status: entitlement.status,
      allowed: entitlement.allowed,
      restricted: entitlement.restricted,
      grace_active: entitlement.grace_active,
      desktop_mode: "read_only",
      mobile_mode: "blocked",
      workstation_mode: "blocked",
    };
  }

  if (entitlement.status === "suspended") {
    return {
      state: "restricted",
      display_status: "Restricted",
      summary: "This shop is manually suspended until an admin restores billing access.",
      reason: entitlement.reason,
      billing_status: entitlement.status,
      allowed: entitlement.allowed,
      restricted: entitlement.restricted,
      grace_active: entitlement.grace_active,
      desktop_mode: "read_only",
      mobile_mode: "queue_only",
      workstation_mode: "blocked",
    };
  }

  if (entitlement.grace_active) {
    return {
      state: "grace",
      display_status: "Payment Needed",
      summary: "Payment is needed. Desktop stays read-only, Mobile keeps queued punches only, and Workstation sign-in is paused until billing is restored.",
      reason: entitlement.reason,
      billing_status: entitlement.status,
      allowed: entitlement.allowed,
      restricted: entitlement.restricted,
      grace_active: entitlement.grace_active,
      desktop_mode: "read_only",
      mobile_mode: "queue_only",
      workstation_mode: "blocked",
    };
  }

  if (entitlement.status === "expired") {
    return {
      state: "expired",
      display_status: "Expired",
      summary: "This shop has expired. Desktop is read-only and Mobile and Workstation are blocked until billing is restored.",
      reason: entitlement.reason,
      billing_status: entitlement.status,
      allowed: entitlement.allowed,
      restricted: entitlement.restricted,
      grace_active: entitlement.grace_active,
      desktop_mode: "read_only",
      mobile_mode: "blocked",
      workstation_mode: "blocked",
    };
  }

  return {
    state: "restricted",
    display_status: "Restricted",
    summary: "Shop access is restricted until billing is restored. Desktop is read-only, Mobile keeps queued punches only, and Workstation is blocked.",
    reason: entitlement.reason,
    billing_status: entitlement.status,
    allowed: entitlement.allowed,
    restricted: entitlement.restricted,
    grace_active: entitlement.grace_active,
    desktop_mode: "read_only",
    mobile_mode: "queue_only",
    workstation_mode: "blocked",
  };
}
