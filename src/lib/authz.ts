// REPLACE ENTIRE FILE: src/lib/authz.ts
//
// Centralized server-side authorization helpers for RunBook Control.
// Use in API routes to avoid duplicated logic.
//
// Adds BILLING ENFORCEMENT (server-side) for WRITE routes via:
//   requireBillingWriteAllowed(shopId)
//   requireShopWriteAllowedAal2(shopId)  // (shop access/admin + billing gate)
//
// Billing gate modes (env):
//   RUNBOOK_BILLING_GATE_MODE = "hard" | "soft" | "hybrid" (default "hybrid")
//
// Semantics used here:
// - soft   => never blocks writes (logs still possible later)
// - hard   => blocks writes unless billing is OK (or platform admin)
// - hybrid => blocks writes unless billing is OK (or platform admin)
//            (reads should remain allowed; only call this helper from write routes)
//
// Billing is considered OK when ANY is true:
// - billing_status is "active" or "trialing"
// - billing_current_period_end is in the future (grace window)
//
// Notes:
// - If rb_shops billing columns are missing, hard/hybrid will FAIL CLOSED with a clear error.
// - Platform admins always bypass billing enforcement.

import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

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

function isIsoInFuture(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return false;
  return t > Date.now();
}

function isBillingStatusOk(status: string | null | undefined): boolean {
  const s = String(status ?? "").toLowerCase();
  return s === "active" || s === "trialing";
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
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error("Access denied for shop.");
  return { user, shopId, isAdmin: false };
}

/**
 * Enforce billing for WRITE routes.
 * Call this only after you've validated shop access/admin and have a UUID shopId.
 */
export async function requireBillingWriteAllowed(shopId: string) {
  assertUuid("shopId", shopId);

  const mode = getBillingGateMode();
  if (mode === "soft") return { ok: true as const, mode, reason: "mode=soft" };

  // Platform admins bypass billing gate
  const { user } = await requireAal2();
  if (await isPlatformAdmin(user.id)) return { ok: true as const, mode, reason: "platform_admin" };

  const admin = supabaseAdmin();

  // Must exist + read billing state
  const { data: shop, error } = await admin
    .from("rb_shops")
    .select("id,billing_status,billing_current_period_end")
    .eq("id", shopId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!shop?.id) throw new Error("Shop not found");

  const statusOk = isBillingStatusOk(shop.billing_status);
  const graceOk = isIsoInFuture(shop.billing_current_period_end);

  const billingOk = statusOk || graceOk;

  if (billingOk) return { ok: true as const, mode, reason: statusOk ? "status_ok" : "grace_ok" };

  // hard + hybrid block writes when not OK
  throw new Error("Billing required: shop is not active/trialing and is outside grace period.");
}

/**
 * Convenience wrapper for shop-scoped WRITE routes:
 * - requires AAL2
 * - requires (shop member OR platform admin)
 * - enforces billing gate (except platform admin bypass)
 */
export async function requireShopWriteAllowedAal2(shopId: string) {
  const ctx = await requireShopAccessOrAdminAal2(shopId);
  await requireBillingWriteAllowed(shopId);
  return ctx;
}
