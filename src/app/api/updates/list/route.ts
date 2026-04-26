import { NextResponse } from "next/server";
import { requirePlatformAdminAal2 } from "@/lib/authz";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isMissingColumnError(message: string) {
  const value = String(message ?? "").toLowerCase();
  return value.includes("column") && value.includes("does not exist");
}

export async function GET(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    rateLimitOrThrow({ key: `updates:list:${ip}`, limit: 120, windowMs: 60_000 });

    await requirePlatformAdminAal2();

    const admin = supabaseAdmin();
    const selectNew = "id,channel,version,file_path,notes,sha256,created_at,updated_at,created_by";
    const selectOld = "id,channel,version,file_path,notes,sha256,created_at,created_by";

    let rows: any[] | null = null;

    const primary = await admin
      .from("rb_update_packages")
      .select(selectNew)
      .order("created_at", { ascending: false })
      .limit(500);

    if (!primary.error) {
      rows = (primary.data ?? []) as any[];
    } else if (isMissingColumnError(primary.error.message)) {
      const fallback = await admin
        .from("rb_update_packages")
        .select(selectOld)
        .order("created_at", { ascending: false })
        .limit(500);

      if (fallback.error) {
        return NextResponse.json({ ok: false, error: fallback.error.message }, { status: 500 });
      }

      rows = (fallback.data ?? []) as any[];
    } else {
      return NextResponse.json({ ok: false, error: primary.error.message }, { status: 500 });
    }

    const packages = (rows ?? []).map((row) => ({
      id: row.id,
      channel: row.channel ?? null,
      version: row.version ?? null,
      file_path: row.file_path ?? null,
      notes: row.notes ?? null,
      sha256: row.sha256 ?? null,
      created_at: row.created_at ?? null,
      updated_at: row.updated_at ?? null,
      created_by: row.created_by ?? null,
    }));

    return NextResponse.json({ ok: true, packages });
  } catch (e: any) {
    const msg = e?.message ?? "Server error";
    const status =
      /not authenticated/i.test(msg) ? 401 :
      /mfa required/i.test(msg) ? 403 :
      /not a platform admin/i.test(msg) ? 403 :
      500;

    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
