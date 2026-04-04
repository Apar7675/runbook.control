import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeCompanyValue(value: string) {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function overlapScore(left: string, right: string) {
  if (!left || !right) return 0;
  if (left === right) return 10_000;
  if (left.includes(right) || right.includes(left)) return 5_000 + Math.min(left.length, right.length);

  let score = 0;
  for (const ch of new Set(right.split(""))) {
    if (left.includes(ch)) score += 1;
  }
  return score;
}

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const rawQuery = String(url.searchParams.get("query") ?? "").trim();
    const query = normalizeCompanyValue(rawQuery);

    if (!query) {
      return NextResponse.json({ ok: false, error: "Missing query" }, { status: 400, headers: corsHeaders(req) });
    }

    const admin = supabaseAdmin();
    let data: any[] | null = null;
    let error: any = null;

    ({ data, error } = await admin
      .from("rb_shops")
      .select("id,name,code,created_at")
      .order("created_at", { ascending: false })
      .limit(200));

    if (error?.message && /column .*code/i.test(error.message)) {
      ({ data, error } = await admin
        .from("rb_shops")
        .select("id,name,created_at")
        .order("created_at", { ascending: false })
        .limit(200));
    }

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500, headers: corsHeaders(req) });
    }

    const rows = data ?? [];
    let best: any = null;
    let bestScore = 0;

    for (const row of rows) {
      const score = Math.max(
        overlapScore(normalizeCompanyValue(row?.name), query),
        overlapScore(normalizeCompanyValue(row?.code), query)
      );

      if (score > bestScore) {
        best = row;
        bestScore = score;
      }
    }

    if (!best || bestScore < 4) {
      return NextResponse.json({ ok: false, error: "Company not found" }, { status: 404, headers: corsHeaders(req) });
    }

    return NextResponse.json({
      ok: true,
      shop: {
        id: String(best.id),
        name: String(best.name ?? "Unnamed Company"),
        code: String(best.code ?? best.name ?? "Unnamed Company"),
      },
    }, { headers: corsHeaders(req) });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Server error" }, { status: 500, headers: corsHeaders(req) });
  }
}
