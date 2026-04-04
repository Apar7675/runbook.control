import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/desktopAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getShopMembership(admin: any, shopId: string, userId: string) {
  const { data, error } = await admin
    .from("rb_shop_members")
    .select("id")
    .eq("shop_id", shopId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error("Access denied");
}

export async function POST(req: Request) {
  try {
    const { user } = await requireSessionUser(req);
    const body = await req.json().catch(() => ({}));
    const shop_id = String(body.shop_id ?? "").trim();
    const workstation_id = String(body.workstation_id ?? "").trim();
    const workstation_name = String(body.workstation_name ?? "").trim() || "RunBook Workstation";

    if (!shop_id) return NextResponse.json({ ok: false, error: "Missing shop_id" }, { status: 400 });
    if (!workstation_id) return NextResponse.json({ ok: false, error: "Missing workstation_id" }, { status: 400 });

    const admin = supabaseAdmin();
    await getShopMembership(admin, shop_id, user.id);

    const { data: existing, error: existingError } = await admin
      .from("rb_devices")
      .select("id,shop_id,status,device_type,name")
      .eq("id", workstation_id)
      .maybeSingle();

    if (existingError) return NextResponse.json({ ok: false, error: existingError.message }, { status: 500 });

    if (existing?.id) {
      if (String(existing.shop_id ?? "").trim() !== shop_id) {
        return NextResponse.json({ ok: false, error: "Workstation already belongs to another shop." }, { status: 403 });
      }
      if (String(existing.device_type ?? "").trim().toLowerCase() !== "workstation") {
        return NextResponse.json({ ok: false, error: "Device id is not a workstation device." }, { status: 403 });
      }
      if (String(existing.status ?? "").trim().toLowerCase() !== "active") {
        return NextResponse.json({ ok: false, error: "Workstation is disabled." }, { status: 403 });
      }

      const { error: updateError } = await admin
        .from("rb_devices")
        .update({ name: workstation_name })
        .eq("id", workstation_id);

      if (updateError) return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
      return NextResponse.json({ ok: true, workstation: { id: workstation_id, shop_id, name: workstation_name, status: "active", device_type: "workstation" }, existing: true });
    }

    const { error: insertError } = await admin
      .from("rb_devices")
      .insert({ id: workstation_id, shop_id, name: workstation_name, device_type: "workstation", status: "active" });

    if (insertError) return NextResponse.json({ ok: false, error: insertError.message }, { status: 500 });
    return NextResponse.json({ ok: true, workstation: { id: workstation_id, shop_id, name: workstation_name, status: "active", device_type: "workstation" }, existing: false });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    const status = /not authenticated/i.test(msg) ? 401 : /access denied/i.test(msg) ? 403 : 400;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

