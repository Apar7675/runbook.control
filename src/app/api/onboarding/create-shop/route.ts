import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function isMissingTableError(msg: string) {
  const m = (msg || "").toLowerCase();
  return m.includes("does not exist") || m.includes("relation") || m.includes("schema cache") || m.includes("not find the table");
}

async function insertShop(admin: any, name: string) {
  // Try rb_shops first (your newer schema), then fallback to shops (older schema)
  const tryTables = ["rb_shops", "shops"];

  for (const t of tryTables) {
    const { data, error } = await admin.from(t).insert({ name }).select("id,name").single();
    if (!error) return { table: t, shop: data };

    if (isMissingTableError(error.message)) continue;
    throw new Error(error.message);
  }

  throw new Error("No shops table found (tried rb_shops, shops).");
}

async function insertMembership(admin: any, shopId: string, userId: string) {
  // Try rb_shop_members first, then fallback
  const tryTables = ["rb_shop_members", "shop_members"];

  for (const t of tryTables) {
    const { error } = await admin.from(t).insert({ shop_id: shopId, user_id: userId, role: "owner" });
    if (!error) return { table: t };

    if (isMissingTableError(error.message)) continue;
    throw new Error(error.message);
  }

  throw new Error("No shop_members table found (tried rb_shop_members, shop_members).");
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const name = String((body as any)?.name ?? "").trim();

    if (name.length < 2) {
      return NextResponse.json({ ok: false, error: "Shop name is too short." }, { status: 400 });
    }

    // Get authed user from SSR supabase client (cookie session)
    const supabase = await supabaseServer();
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id ?? "";
    if (!userId) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

    // Service role admin client for DB writes (web/server-side only)
    const admin = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { shop } = await insertShop(admin, name);
    await insertMembership(admin, shop.id, userId);

    return NextResponse.json({ ok: true, shop_id: shop.id, name: shop.name });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Server error" }, { status: 500 });
  }
}
