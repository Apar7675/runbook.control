import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/desktopAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { assertUuid, isPlatformAdmin } from "@/lib/authz";
import { requireShopEntitlementWriteAllowed, statusForBillingWriteError } from "@/lib/billing/writeGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function s(v: any) {
  return String(v ?? "").trim();
}

function sanitizeSegment(value: string, fallback: string) {
  const cleaned = s(value).toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || fallback;
}

async function authorizeAvatarUpload(admin: any, shopId: string, employeeCode: string, userId: string) {
  assertUuid("shop_id", shopId);

  if (await isPlatformAdmin(userId)) {
    return { isPlatformAdmin: true, reason: "platform_admin" };
  }

  const { data: membership, error: membershipError } = await admin
    .from("rb_shop_members")
    .select("shop_id,user_id,role")
    .eq("shop_id", shopId)
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (membershipError) throw new Error(membershipError.message);
  if (!membership?.shop_id) {
    console.warn(`[Auth] desktop/upload-avatar blocked: user=${userId} shop_id=${shopId} reason=shop_access_required`);
    throw new Error("Access denied");
  }

  const role = s(membership.role).toLowerCase();
  if (role === "owner" || role === "admin") {
    return { isPlatformAdmin: false, reason: "shop_admin" };
  }

  const { data: employee, error: employeeError } = await admin
    .from("employees")
    .select("id,auth_user_id")
    .eq("shop_id", shopId)
    .eq("employee_code", employeeCode)
    .maybeSingle();

  if (employeeError) throw new Error(employeeError.message);
  if (s(employee?.auth_user_id) === userId) {
    return { isPlatformAdmin: false, reason: "self" };
  }

  console.warn(`[Auth] desktop/upload-avatar blocked: user=${userId} shop_id=${shopId} reason=self_or_shop_admin_required`);
  throw new Error("Access denied");
}

export async function POST(req: Request) {
  try {
    const { user } = await requireSessionUser(req);
    const body = await req.json().catch(() => ({}));
    const shopId = s((body as any).shop_id);
    const employeeCode = s((body as any).employee_code);
    const fileName = sanitizeSegment(s((body as any).file_name), "avatar.jpg");
    const contentType = s((body as any).content_type) || "image/jpeg";
    const imageBase64 = s((body as any).image_base64);

    if (!shopId) return NextResponse.json({ ok: false, error: "shop_id required" }, { status: 400 });
    if (!employeeCode) return NextResponse.json({ ok: false, error: "employee_code required" }, { status: 400 });
    if (!imageBase64) return NextResponse.json({ ok: false, error: "image_base64 required" }, { status: 400 });

    const admin = supabaseAdmin();
    const auth = await authorizeAvatarUpload(admin, shopId, employeeCode, user.id);
    if (!auth.isPlatformAdmin) {
      await requireShopEntitlementWriteAllowed(shopId, "desktop/upload-avatar");
    }

    const bytes = Buffer.from(imageBase64, "base64");
    const safeEmployeeCode = sanitizeSegment(employeeCode, "employee");
    const path = `shops/${shopId}/employees/${safeEmployeeCode}/${Date.now()}_${fileName}`;

    const { error } = await admin.storage.from("avatars").upload(path, bytes, {
      cacheControl: "3600",
      upsert: true,
      contentType,
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, path });
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    const status = /not authenticated/i.test(msg) ? 401 : /access denied|authorized/i.test(msg) ? 403 : /must be a uuid/i.test(msg) ? 400 : statusForBillingWriteError(msg, 500);
    return NextResponse.json({ ok: false, error: status === 500 || status === 400 ? msg : "Forbidden" }, { status });
  }
}
