import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sha256Hex } from "@/lib/crypto";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const token = String(body?.token ?? "").trim();
    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

    const token_hash = sha256Hex(token);
    const admin = supabaseAdmin();

    const { data: row, error: e1 } = await admin
      .from("rb_device_activation_tokens")
      .select("*")
      .eq("token_hash", token_hash)
      .maybeSingle();

    if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });
    if (!row) return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    if (row.used_at) return NextResponse.json({ error: "Token already used" }, { status: 409 });
    if (new Date(row.expires_at).getTime() < Date.now()) return NextResponse.json({ error: "Token expired" }, { status: 410 });

    const { error: e2 } = await admin
      .from("rb_device_activation_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", row.id);

    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });

    const { data: device, error: e3 } = await admin
      .from("rb_devices")
      .select("id, shop_id, name, status, created_at")
      .eq("id", row.device_id)
      .single();

    if (e3) return NextResponse.json({ error: e3.message }, { status: 500 });

    // Write audit (service role bypasses RLS)
    await admin.from("rb_audit").insert({
      shop_id: device.shop_id,
      actor_kind: "device",
      actor_user_id: null,
      action: "device.activated",
      entity_type: "device",
      entity_id: device.id,
      details: { device_name: device.name },
    });

    return NextResponse.json({ device }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
