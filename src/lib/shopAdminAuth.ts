import { assertUuid, isPlatformAdmin, requireAal2 } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function requireShopAdminOrPlatformAdmin(shopId: string) {
  assertUuid("shopId", shopId);
  const { user } = await requireAal2();

  if (await isPlatformAdmin(user.id)) {
    return { user, shopId, isPlatformAdmin: true, role: "platform_admin" };
  }

  const admin = supabaseAdmin();
  const { data: member, error } = await admin
    .from("rb_shop_members")
    .select("id,role,is_active")
    .eq("shop_id", shopId)
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const role = String(member?.role ?? "").trim().toLowerCase();
  if (!member?.id || (role !== "owner" && role !== "admin")) {
    throw new Error("Access denied");
  }

  return { user, shopId, isPlatformAdmin: false, role };
}
