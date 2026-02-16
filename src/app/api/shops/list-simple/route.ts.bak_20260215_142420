// REPLACE ENTIRE FILE: src/app/api/shops/list-simple/route.ts
//
// HARDENING (this pass):
// - Uses centralized authz helpers (AAL2 + platform admin).
// - Keeps rate limit.
// - Uses server supabase for reads (RLS already limits; platform admin required anyway).
// - Consistent error/status mapping.

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";
import { requirePlatformAdminAal2 } from "@/lib/authz";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    rateLimitOrThrow({ key: `shops:list-simple:${ip}`, limit: 120, windowMs: 60_000 });

    await requirePlatformAdminAal2();

    const supabase = await supabaseServer();
    const { data, error } = await supabase.from("rb_shops").select("id,name,created_at").order("created_at", { ascending: false });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, shops: data ?? [] });
  } catch (e: any) {
    const msg = e?.message ?? "Server error";
    const status =
      /not authenticated/i.test(msg) ? 401 : /mfa required/i.test(msg) ? 403 : /not a platform admin/i.test(msg) ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
