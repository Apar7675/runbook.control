import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    rateLimitOrThrow({ key: `billing:status:${ip}`, limit: 120, windowMs: 60_000 });

    const supabase = await supabaseServer();
    const { data: userRes, error: authErr } = await supabase.auth.getUser();
    if (authErr || !userRes.user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    const url = new URL(req.url);
    const shop_id = (url.searchParams.get("shop_id") ?? "").trim();
    if (!shop_id) return NextResponse.json({ ok: false, error: "Missing shop_id" }, { status: 400 });

    const admin = supabaseAdmin();
    const { data: shop, error } = await admin
      .from("rb_shops")
      .select("billing_status,billing_current_period_end,stripe_customer_id,stripe_subscription_id")
      .eq("id", shop_id)
      .maybeSingle();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    if (!shop) return NextResponse.json({ ok: false, error: "Shop not found" }, { status: 404 });

    return NextResponse.json({ ok: true, shop });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}
