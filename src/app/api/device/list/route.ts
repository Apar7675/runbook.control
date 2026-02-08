// REPLACE ENTIRE FILE: src/app/api/device/list/route.ts

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    rateLimitOrThrow({ key: `device:list:${ip}`, limit: 120, windowMs: 60_000 });

    const supabase = await supabaseServer();

    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes.user ?? null;
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const aal = (aalData?.currentLevel as "aal1" | "aal2" | "aal3" | null) ?? "aal1";
    if (aal !== "aal2") return NextResponse.json({ error: "MFA required (AAL2)" }, { status: 403 });

    const { data: row } = await supabase
      .from("rb_control_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!row) return NextResponse.json({ error: "Not a platform admin" }, { status: 403 });

    const admin = supabaseAdmin();

    const { data: devices, error: dErr } = await admin
      .from("rb_devices")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (dErr) return NextResponse.json({ error: dErr.message }, { status: 500 });

    const deviceIds = (devices ?? []).map((d: any) => d.id);
    const { data: tokens, error: tErr } = await admin
      .from("rb_device_tokens")
      .select("id,device_id,created_at,issued_at,revoked_at,last_seen_at,label")
      .in("device_id", deviceIds.length ? deviceIds : ["00000000-0000-0000-0000-000000000000"]);

    if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, devices: devices ?? [], tokens: tokens ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
