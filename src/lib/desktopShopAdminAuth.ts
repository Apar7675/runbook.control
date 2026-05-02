import { assertUuid, isPlatformAdmin } from "@/lib/authz";
import { requireSessionUser } from "@/lib/desktopAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function requireDesktopShopAdmin(req: Request, shopId: string) {
  assertUuid("shop_id", shopId);
  const { user } = await requireSessionUser(req);

  if (await isPlatformAdmin(user.id)) {
    return { user, shopId, isPlatformAdmin: true, role: "platform_admin" };
  }

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("rb_shop_members")
    .select("id,role,is_active")
    .eq("shop_id", shopId)
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const role = String(data?.role ?? "").trim().toLowerCase();
  if (!data?.id || (role !== "owner" && role !== "admin")) {
    throw new Error("Access denied");
  }

  return { user, shopId, isPlatformAdmin: false, role };
}
