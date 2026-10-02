import { getShopEntitlement } from "@/lib/billing/entitlement";

export async function requireShopEntitlementWriteAllowed(shopId: string, action: string) {
  const entitlement = await getShopEntitlement(shopId);
  if (entitlement.allowed && !entitlement.restricted) {
    return entitlement;
  }

  const reason = entitlement.reason || "entitlement_restricted";
  console.warn(`[Billing] ${action} blocked: shop_id=${shopId} reason=${reason}`);
  const error = new Error(`Billing required: ${reason}`);
  (error as Error & { status?: number }).status = 403;
  throw error;
}

export function statusForBillingWriteError(message: string, fallback = 500) {
  return /billing required/i.test(message) ? 403 : fallback;
}
