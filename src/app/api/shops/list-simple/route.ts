// REPLACE ENTIRE FILE: src/app/api/shops/list-simple/route.ts

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    rateLimitOrThrow({ key: `shops:list-simple:${ip}`, limit: 120, windowMs: 60_000 });

    const supabase = await supabaseServer();

    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes.user ?? null;
    if (!user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

    // Must be AAL2 + platform admin (devices are control-plane)
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const aal = (aalData?.currentLevel as "aal1" | "aal2" | "aal3" | null) ?? "aal1";
    if (aal !== "aal2") return NextResponse.json({ ok: false, error: "MFA required (AAL2)" }, { status: 403 });

    const { data: row } = await supabase
      .from("rb_control_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!row) return NextResponse.json({ ok: false, error: "Not a platform admin" }, { status: 403 });

    const { data, error } = await supabase
      .from("rb_shops")
      .select("id,name,created_at")
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, shops: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Server error" }, { status: 500 });
  }
}
