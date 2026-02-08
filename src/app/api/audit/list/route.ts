// REPLACE ENTIRE FILE: src/app/api/audit/list/route.ts

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    rateLimitOrThrow({ key: `audit:list:${ip}`, limit: 60, windowMs: 60_000 });

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

    const url = new URL(req.url);
    const limit = Math.min(200, Math.max(10, Number(url.searchParams.get("limit") ?? "100")));

    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("rb_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, rows: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
