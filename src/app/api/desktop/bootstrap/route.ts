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

function isMissingTable(msg: string) {
  const m = (msg || "").toLowerCase();
  return m.includes("schema cache") || m.includes("not find the table") || m.includes("does not exist") || m.includes("relation");
}

function tryExtractMissingColumn(msg: string): string | null {
  // Postgres style: column "foo" of relation "rb_shops" does not exist
  const m = msg.match(/column\s+"([^"]+)"\s+of\s+relation/i);
  return m?.[1] ?? null;
}

async function insertWithAutoStrip(admin: any, table: string, payload: Record<string, any>, selectCols = "id,name") {
  // Try insert; if a column doesn't exist, remove it and retry (up to 12 keys).
  let working: Record<string, any> = { ...payload };

  for (let attempt = 0; attempt < 12; attempt++) {
    const q = admin.from(table).insert(working).select(selectCols).single();
    const { data, error } = await q;

    if (!error) return data;

    const msg = String(error.message || "");
    const col = tryExtractMissingColumn(msg);
    if (col && Object.prototype.hasOwnProperty.call(working, col)) {
      delete working[col];
      continue;
    }

    throw new Error(msg);
  }

  throw new Error(`Insert failed after stripping columns for table ${table}`);
}

async function createShop(admin: any, shopPayload: Record<string, any>) {
  // Prefer rb_shops, fallback to shops
  const tables = ["rb_shops", "shops"];
  let lastErr = "";

  for (const t of tables) {
    try {
      const shop = await insertWithAutoStrip(admin, t, shopPayload, "id,name");
      return { shop, table: t };
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      lastErr = msg;

      // If table missing, try next
      if (isMissingTable(msg)) continue;

      // Other errors: stop
      throw new Error(msg);
    }
  }

  throw new Error(`No shop table available (tried rb_shops, shops). Last error: ${lastErr}`);
}

async function createMembership(admin: any, shopId: string, userId: string) {
  const tables = ["rb_shop_members", "shop_members"];
  let lastErr = "";

  for (const t of tables) {
    try {
      // Some schemas use role, some might not; strip if needed.
      await insertWithAutoStrip(admin, t, { shop_id: shopId, user_id: userId, role: "owner" }, "shop_id,user_id");
      return { table: t };
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      lastErr = msg;
      if (isMissingTable(msg)) continue;
      throw new Error(msg);
    }
  }

  throw new Error(`No membership table available (tried rb_shop_members, shop_members). Last error: ${lastErr}`);
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

    // Optional profile upsert (ignore if table missing/columns mismatch)
    try {
      await insertWithAutoStrip(admin, "rb_profiles", {
        id: user.id,
        first_name,
        last_name,
        phone: sOrNull(body.phone),
        email: user.email ?? null,
        updated_at: new Date().toISOString(),
      }, "id");
    } catch {
      // ignore
    }

    // Shop payload (will auto-strip unknown columns)
    const shopPayload: Record<string, any> = {
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
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { shop, table } = await createShop(admin, shopPayload);

    await createMembership(admin, shop.id, user.id);

    return NextResponse.json({ ok: true, shop_id: shop.id, shop_name: shop.name, shop_table: table });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    const status = /not authenticated/i.test(msg) ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
