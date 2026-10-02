import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";
import { assertUuid, isPlatformAdmin, requireAal2 } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabase/admin";

async function requireSupportBundleAccess(shopId: string) {
  assertUuid("shopId", shopId);
  const { user } = await requireAal2();

  if (await isPlatformAdmin(user.id)) {
    return { user, isPlatformAdmin: true };
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
    console.warn(`[Auth] support/bundle blocked: user=${user.id} shop_id=${shopId} reason=shop_admin_required`);
    const denied = new Error("Access denied");
    (denied as Error & { status?: number }).status = 403;
    throw denied;
  }

  return { user, isPlatformAdmin: false };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const shopId = String(body.shopId ?? "").trim();
    const notes = body.notes ? String(body.notes) : null;
    const path = String(body.path ?? "").trim();

    if (!shopId || !path) return NextResponse.json({ error: "Missing shopId or path" }, { status: 400 });
    const { user } = await requireSupportBundleAccess(shopId);

    const supabase = await supabaseServer();

    const { data: row, error } = await supabase.from("rb_support_bundles").insert({
      shop_id: shopId,
      file_path: path,
      notes,
      uploaded_by: user.id,
    }).select("*").single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await auditLog({
      shop_id: shopId,
      action: "support_bundle.uploaded",
      entity_type: "support_bundle",
      entity_id: row.id,
      details: { path, notes },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    const status =
      (e as any)?.status ??
      (/not authenticated/i.test(msg) ? 401 :
      /mfa required|access denied/i.test(msg) ? 403 :
      /must be a uuid/i.test(msg) ? 400 :
      500);
    return NextResponse.json({ error: status === 500 ? msg : status === 400 ? msg : "Forbidden" }, { status });
  }
}
