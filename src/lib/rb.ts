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
  const supabase = await supabaseServer();
  const { data, error } = await supabase.from("rb_shops").select("*").eq("id", shopId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as RBShop | null;
}

/**
 * rb_devices is locked down -> use service role.
 */
export async function rbListShopDevices(shopId: string): Promise<RBDevice[]> {
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
  const supabase = await supabaseServer();
  const { data, error } = await supabase.from("rb_update_policy").select("*").eq("shop_id", shopId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as RBUpdatePolicy | null;
}
