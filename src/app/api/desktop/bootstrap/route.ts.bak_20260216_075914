import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireUserFromBearer } from "@/lib/desktopAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function s(v: any) { return String(v ?? "").trim(); }
function sOrNull(v: any) { const x = s(v); return x ? x : null; }

function nInt(v: any, def = 0, min = 0, max = 100000) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  const i = Math.trunc(n);
  if (i < min) return min;
  if (i > max) return max;
  return i;
}

export async function POST(req: Request) {
  try {
    const { user } = await requireUserFromBearer(req);
    const body = await req.json().catch(() => ({}));

    const first_name = s(body.first_name);
    const last_name = s(body.last_name);
    const company_name = s(body.company_name);

    if (!first_name) return NextResponse.json({ ok: false, error: "first_name required" }, { status: 400 });
    if (!last_name) return NextResponse.json({ ok: false, error: "last_name required" }, { status: 400 });
    if (!company_name || company_name.length < 2) return NextResponse.json({ ok: false, error: "company_name required" }, { status: 400 });

    const admin = supabaseAdmin();

    // 1) Upsert profile (if table exists)
    try {
      await admin.from("rb_profiles").upsert({
        id: user.id,
        first_name,
        last_name,
        phone: sOrNull(body.phone),
        email: user.email ?? null,
        updated_at: new Date().toISOString(),
      });
    } catch {
      // ok if rb_profiles doesn't exist yet
    }

    // 2) Create shop (rb_shops is your current schema)
    const { data: shop, error: shopErr } = await admin
      .from("rb_shops")
      .insert({
        name: company_name,
        website: sOrNull(body.website),
        address1: sOrNull(body.address1),
        address2: sOrNull(body.address2),
        city: sOrNull(body.city),
        state: sOrNull(body.state),
        zip: sOrNull(body.zip),
        country: sOrNull(body.country),
        machines_count: nInt(body.machines, 0),
        employees_count: nInt(body.employees, 0),
        departments: Array.isArray(body.departments) ? body.departments : [],
        billing_status: "none",
      })
      .select("id,name")
      .single();

    if (shopErr) throw new Error(shopErr.message);

    // 3) Owner membership
    const { error: memErr } = await admin.from("rb_shop_members").insert({
      shop_id: shop.id,
      user_id: user.id,
      role: "owner",
    });

    if (memErr) throw new Error(memErr.message);

    return NextResponse.json({ ok: true, shop_id: shop.id, shop_name: shop.name });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    const status = /not authenticated/i.test(msg) ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
