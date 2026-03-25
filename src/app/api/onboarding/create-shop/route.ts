// REPLACE / CREATE FILE: src/app/api/onboarding/create-shop/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    rateLimitOrThrow({ key: `onboarding:create_shop:ip:${ip}`, limit: 20, windowMs: 60_000 });

    const body = await req.json().catch(() => ({}));
    const name = String((body as any)?.name ?? "").trim();

    if (name.length < 2) {
      return NextResponse.json({ ok: false, error: "Shop name is too short." }, { status: 400 });
    }

    // Authenticated user (cookie-based SSR auth)
    const supabase = await supabaseServer();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    const userId = data.user.id;

    const admin = supabaseAdmin();

    // 1) Create shop
    const { data: shop, error: shopErr } = await admin
      .from("shops")
      .insert({ name })
      .select("id,name")
      .single();

    if (shopErr) return NextResponse.json({ ok: false, error: shopErr.message }, { status: 500 });

    // 2) Create membership (owner)
    const { error: memErr } = await admin
      .from("shop_members")
      .insert({ shop_id: shop.id, user_id: userId, role: "owner" });

    if (memErr) return NextResponse.json({ ok: false, error: memErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, shop_id: shop.id, name: shop.name });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Server error" }, { status: 500 });
  }
}
