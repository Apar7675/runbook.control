import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireSessionUser } from "@/lib/desktopAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { user } = await requireSessionUser(req);
    const body = await req.json().catch(() => ({}));
    const shop_id = String(body.shop_id ?? "").trim();
    const device_id = String(body.device_id ?? "").trim();

    if (!shop_id) return NextResponse.json({ ok: false, error: "Missing shop_id" }, { status: 400 });
    if (!device_id) return NextResponse.json({ ok: false, error: "Missing device_id" }, { status: 400 });

    const admin = supabaseAdmin();
    const { data: mem } = await admin
      .from("rb_shop_members")
      .select("role")
      .eq("shop_id", shop_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!mem) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

    const { data: existing, error: existingError } = await admin
      .from("rb_devices")
      .select("id,shop_id,status,device_role")
      .eq("id", device_id)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json({ ok: false, error: existingError.message }, { status: 500 });
    }

    if (existing?.id) {
      if (String(existing.shop_id ?? "").trim() !== shop_id) {
        return NextResponse.json({ ok: false, error: "Device already belongs to another shop." }, { status: 403 });
      }

      const { error: updateError } = await admin
        .from("rb_devices")
        .update({ status: "active", device_type: "desktop" })
        .eq("id", device_id);

      if (updateError) {
        return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true, existing: true, device_id, shop_id, status: "active", device_role: String(existing.device_role ?? "").trim() });
    }

    const { error: insertError } = await admin
      .from("rb_devices")
      .insert({
        id: device_id,
        shop_id,
        name: `Desktop ${device_id.slice(0, 8)}`,
        device_type: "desktop",
        status: "active",
      });

    if (insertError) {
      return NextResponse.json({ ok: false, error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, existing: false, device_id, shop_id, status: "active", device_role: "" });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    const status = /not authenticated/i.test(msg) ? 401 : 400;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
