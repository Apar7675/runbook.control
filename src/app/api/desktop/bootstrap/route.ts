// REPLACE ENTIRE FILE: src/app/api/desktop/bootstrap/route.ts

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireUserFromBearer } from "@/lib/desktopAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SHOP_TABLE = "rb_shops";
const MEMBER_TABLE = "rb_shop_members";
const PROFILE_TABLE = "rb_profiles";

function s(v: any) {
  return String(v ?? "").trim();
}
function sOrNull(v: any) {
  const x = s(v);
  return x ? x : null;
}
function nInt(v: any, def = 0, min = 0, max = 100000) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  const i = Math.trunc(n);
  if (i < min) return min;
  if (i > max) return max;
  return i;
}

function formatSbError(error: any) {
  if (!error) return "Unknown error";
  const msg = String(error.message ?? error ?? "");
  const code = error.code ? ` code=${String(error.code)}` : "";
  const details = error.details ? ` details=${String(error.details)}` : "";
  const hint = error.hint ? ` hint=${String(error.hint)}` : "";
  return `${msg}${code}${details}${hint}`;
}

function isPostgrestSchemaCacheError(msg: string) {
  const m = (msg || "").toLowerCase();
  return m.includes("schema cache") || m.includes("could not find the") || m.includes("not find the table");
}

function tryExtractMissingColumn(msg: string): string | null {
  // Postgres style: column "foo" of relation "rb_shops" does not exist
  const m = msg.match(/column\s+"([^"]+)"\s+of\s+relation/i);
  return m?.[1] ?? null;
}

async function insertWithAutoStrip(admin: any, table: string, payload: Record<string, any>, selectCols: string) {
  // Try insert; if a column doesn't exist, remove it and retry (up to 12 keys).
  let working: Record<string, any> = { ...payload };

  for (let attempt = 0; attempt < 12; attempt++) {
    const { data, error } = await admin.from(table).insert(working).select(selectCols).single();

    if (!error) return data;

    const msg = formatSbError(error);
    const col = tryExtractMissingColumn(msg);
    if (col && Object.prototype.hasOwnProperty.call(working, col)) {
      delete working[col];
      continue;
    }

    throw new Error(`[${table}] ${msg}`);
  }

  throw new Error(`[${table}] Insert failed after stripping columns`);
}

async function serviceRolePreflight(admin: any, userId: string) {
  // If supabaseAdmin() is accidentally using the ANON key,
  // this will fail. If it passes, we KNOW we are service-role.
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data?.user?.id) {
    throw new Error(
      `supabaseAdmin is NOT service-role (auth.admin.getUserById failed). ` +
        `Check SUPABASE_SERVICE_ROLE_KEY in Vercel and /lib/supabase/admin wiring. ` +
        `Error: ${formatSbError(error)}`
    );
  }
}

async function createShop(admin: any, shopPayload: Record<string, any>) {
  return await insertWithAutoStrip(admin, SHOP_TABLE, shopPayload, "id,name");
}

async function createMembership(admin: any, shopId: string, userId: string) {
  await insertWithAutoStrip(admin, MEMBER_TABLE, { shop_id: shopId, user_id: userId, role: "owner" }, "shop_id,user_id");
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
    if (!company_name || company_name.length < 2) {
      return NextResponse.json({ ok: false, error: "company_name required" }, { status: 400 });
    }

    const admin = supabaseAdmin();

    // ✅ PROVE we’re really using service role
    await serviceRolePreflight(admin, user.id);

    // Optional profile upsert (ignore if table missing/columns mismatch)
    try {
      await insertWithAutoStrip(
        admin,
        PROFILE_TABLE,
        {
          id: user.id,
          first_name,
          last_name,
          phone: sOrNull(body.phone),
          email: user.email ?? null,
          updated_at: new Date().toISOString(),
        },
        "id"
      );
    } catch {
      // ignore
    }

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

    const shop = await createShop(admin, shopPayload);
    await createMembership(admin, shop.id, user.id);

    return NextResponse.json({
      ok: true,
      shop_id: shop.id,
      shop_name: shop.name,
      shop_table: SHOP_TABLE,
      membership_table: MEMBER_TABLE,
    });
  } catch (e: any) {
    const msg = String(e?.message ?? e);

    console.error("DESKTOP_BOOTSTRAP_ERROR:", msg);

    if (isPostgrestSchemaCacheError(msg)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            msg +
            " | This usually means Control is NOT using the service-role key, or the role has no privileges on the table. " +
            "Verify SUPABASE_SERVICE_ROLE_KEY in Vercel and that /lib/supabase/admin uses it.",
        },
        { status: 500 }
      );
    }

    const status = /not authenticated/i.test(msg) ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
