// REPLACE ENTIRE FILE: src/app/api/shops/delete/route.ts
//
// HARDENING (this pass):
// - Uses centralized authz: requires platform admin + AAL2.
// - UUID tripwire on shopId.
// - Rate limit.
// - Keeps RPC approach (DB enforces name match + audit + cascade).
// - Consistent { ok, error } response shape + status mapping.

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";
import { assertUuid, requirePlatformAdminAal2 } from "@/lib/authz";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    rateLimitOrThrow({ key: `shops:delete:${ip}`, limit: 60, windowMs: 60_000 });

    await requirePlatformAdminAal2();

    const body = await req.json().catch(() => ({}));
    const shopId = String((body as any)?.shopId ?? "").trim();
    const confirmName = String((body as any)?.confirmName ?? "").trim();

    if (!shopId) return NextResponse.json({ ok: false, error: "Missing shopId" }, { status: 400 });
    assertUuid("shopId", shopId);

    const supabase = await supabaseServer();

    // Let the DB enforce: admin-only + name match + audit + delete
    const { error } = await supabase.rpc("rb_delete_shop", {
      p_shop_id: shopId,
      p_confirm_name: confirmName,
    });

    if (error) {
      // Map common business errors to 400/403
      const msg = error.message ?? "Failed";
      const lower = msg.toLowerCase();

      if (lower.includes("not authorized")) return NextResponse.json({ ok: false, error: msg }, { status: 403 });
      if (lower.includes("confirmation") || lower.includes("not found") || lower.includes("missing")) {
        return NextResponse.json({ ok: false, error: msg }, { status: 400 });
      }

      return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    const status =
      /not authenticated/i.test(msg) ? 401 : /mfa required/i.test(msg) ? 403 : /not a platform admin/i.test(msg) ? 403 : /must be a uuid/i.test(msg) ? 400 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
