// REPLACE ENTIRE FILE: src/lib/rb.ts
//
// NOTES (this pass):
// - Adds a hard UUID tripwire for shopId inputs (no silent casting).
// - Keeps existing behavior for rb_shops/rb_devices/rb_update_policy.
// - Adds staged-safe helpers for legacy dual-column tables:
//     - purchase_orders.shop_id_uuid (preferred)
//     - components.shop_id_uuid (preferred)
//   (We DO NOT touch/drop legacy text columns here.)

import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type RBShop = { id: string; name: string; created_at: string };
export type RBMember = { id: string; shop_id: string; user_id: string; role: string; created_at: string };

export type RBDevice = {
  id: string;
  shop_id: string;
  name: string;
  status: string;
  created_at: string;

  // keep compatibility with older schema
  device_key?: string | null;
  device_type?: string | null;
};

export type RBUpdatePolicy = {
  id: string;
  shop_id: string;
  channel: string;
  min_version: string | null;
  pinned_version: string | null;
  created_at: string;
};

// Staged dual-column tables (DO NOT use legacy shop_id text in Control)
export type RBPurchaseOrder = {
  id: string;
  created_at: string;
  // staged columns:
  shop_id_uuid?: string | null;
  shop_id?: string | null; // legacy text (must remain for Desktop until migrated)
  [k: string]: any;
};

export type RBComponent = {
  id: string;
  created_at: string;
  // staged columns:
  shop_id_uuid?: string | null;
  shop_id?: string | null; // legacy text (must remain for Desktop until migrated)
  [k: string]: any;
};

function rbAssertUuid(label: string, value: string) {
  // Strict UUID v1-v5
  const ok = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  if (!ok) throw new Error(`${label} must be a UUID. Got: ${value}`);
}

export async function rbGetUserIdOrThrow() {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error) throw new Error(error.message);
  if (!data.user?.id) throw new Error("No authenticated user.");
  return data.user.id;
}

export async function rbListMyShops(): Promise<RBShop[]> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.from("rb_shops").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as RBShop[];
}

/**
 * IMPORTANT:
 * Use maybeSingle so 0 rows doesn't crash the whole app.
 * Returns null if shop is not visible (RLS) or doesn't exist.
 */
export async function rbGetShop(shopId: string): Promise<RBShop | null> {
  rbAssertUuid("shopId", shopId);
  const supabase = await supabaseServer();
  const { data, error } = await supabase.from("rb_shops").select("*").eq("id", shopId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as RBShop | null;
}

/**
 * rb_devices is locked down -> use service role.
 */
export async function rbListShopDevices(shopId: string): Promise<RBDevice[]> {
  rbAssertUuid("shopId", shopId);
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("rb_devices")
    .select("*")
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as RBDevice[];
}

export async function rbGetUpdatePolicy(shopId: string): Promise<RBUpdatePolicy | null> {
  rbAssertUuid("shopId", shopId);
  const supabase = await supabaseServer();
  const { data, error } = await supabase.from("rb_update_policy").select("*").eq("shop_id", shopId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as RBUpdatePolicy | null;
}

/**
 * ===== Staged tenancy helpers (shop_id_uuid preferred) =====
 * Control must query by shop_id_uuid (uuid) and ignore legacy shop_id (text).
 */

export async function rbListPurchaseOrders(shopId: string): Promise<RBPurchaseOrder[]> {
  rbAssertUuid("shopId", shopId);
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("purchase_orders")
    .select("*")
    .eq("shop_id_uuid", shopId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as RBPurchaseOrder[];
}

export async function rbListComponents(shopId: string): Promise<RBComponent[]> {
  rbAssertUuid("shopId", shopId);
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("components")
    .select("*")
    .eq("shop_id_uuid", shopId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as RBComponent[];
}
