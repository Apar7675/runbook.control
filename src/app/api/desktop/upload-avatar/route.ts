import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/desktopAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function s(v: any) {
  return String(v ?? "").trim();
}

function sanitizeSegment(value: string, fallback: string) {
  const cleaned = s(value).toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || fallback;
}

async function ensureMembership(admin: any, shopId: string, userId: string) {
  const { data, error } = await admin
    .from("rb_shop_members")
    .select("shop_id,user_id,role")
    .eq("shop_id", shopId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.shop_id) throw new Error("Not authorized for this shop.");
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
    await ensureMembership(admin, shopId, user.id);

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
    return NextResponse.json({ ok: false, error: msg }, { status: /authorized|authenticated/i.test(msg) ? 401 : 500 });
  }
}
