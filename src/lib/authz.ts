import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getShopEntitlement } from "@/lib/billing/entitlement";

export type AAL = "aal1" | "aal2" | "aal3";
export type BillingGateMode = "hard" | "soft" | "hybrid";

export function assertUuid(label: string, value: string) {
  const ok = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  if (!ok) throw new Error(`${label} must be a UUID. Got: ${value}`);
}

function getBillingGateMode(): BillingGateMode {
  const raw = String(process.env.RUNBOOK_BILLING_GATE_MODE ?? "hybrid").trim().toLowerCase();
  if (raw === "hard" || raw === "soft" || raw === "hybrid") return raw;
  return "hybrid";
}

export async function getUserOrThrow() {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error) throw new Error(error.message);
  if (!data.user?.id) throw new Error("Not authenticated");
  assertUuid("userId", data.user.id);
  return { supabase, user: data.user };
}

export async function requireAal2() {
  const { supabase, user } = await getUserOrThrow();
  const { data: aalData, error: aalErr } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aalErr) throw new Error(aalErr.message);
  const aal = (aalData?.currentLevel as AAL | null) ?? "aal1";
  if (aal !== "aal2") throw new Error("MFA required (AAL2)");
  return { supabase, user, aal };
}

export async function isPlatformAdmin(userId: string): Promise<boolean> {
  assertUuid("userId", userId);
  const admin = supabaseAdmin();
  const { data, error } = await admin.from("rb_control_admins").select("user_id").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  return !!data?.user_id;
}

export async function requirePlatformAdminAal2() {
  const { user } = await requireAal2();
  const ok = await isPlatformAdmin(user.id);
  if (!ok) throw new Error("Not a platform admin");
  return { user };
}

export async function requireShopAccessAal2(shopId: string) {
  assertUuid("shopId", shopId);
  const { user } = await requireAal2();

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("rb_shop_members")
    .select("id")
    .eq("shop_id", shopId)
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error("Access denied for shop.");
  return { user, shopId };
}

export async function requireShopAccessOrAdminAal2(shopId: string) {
  assertUuid("shopId", shopId);
  const { user } = await requireAal2();

  if (await isPlatformAdmin(user.id)) return { user, shopId, isAdmin: true };

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("rb_shop_members")
    .select("id")
    .eq("shop_id", shopId)
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error("Access denied for shop.");
  return { user, shopId, isAdmin: false };
}

export async function requireBillingWriteAllowed(shopId: string) {
  assertUuid("shopId", shopId);

  const mode = getBillingGateMode();
  if (mode === "soft") return { ok: true as const, mode, reason: "mode=soft" };

  const { user } = await requireAal2();
  if (await isPlatformAdmin(user.id)) return { ok: true as const, mode, reason: "platform_admin" };

  const entitlement = await getShopEntitlement(shopId);
  if (entitlement.allowed && !entitlement.restricted) {
    return { ok: true as const, mode, reason: entitlement.reason, entitlement };
  }

  throw new Error(`Billing required: ${entitlement.reason}`);
}

export async function requireShopWriteAllowedAal2(shopId: string) {
  const ctx = await requireShopAccessOrAdminAal2(shopId);
  await requireBillingWriteAllowed(shopId);
  return ctx;
}
