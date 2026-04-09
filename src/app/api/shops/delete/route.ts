import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";
import { assertUuid, requirePlatformAdminAal2 } from "@/lib/authz";
import { isPlatformAdminEmail } from "@/lib/platformAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    rateLimitOrThrow({ key: `shops:delete:${ip}`, limit: 60, windowMs: 60_000 });

    const body = await req.json().catch(() => ({}));
    const shopId = String((body as any)?.shopId ?? "").trim();
    const confirmName = String((body as any)?.confirmName ?? "").trim();

    if (!shopId) return NextResponse.json({ ok: false, error: "Missing shopId" }, { status: 400 });
    assertUuid("shopId", shopId);

    const supabase = await supabaseServer();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      return NextResponse.json({ ok: false, error: userError.message }, { status: 401 });
    }

    if (!user?.id) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    const email = user.email ?? null;
    const isEmailAdmin = isPlatformAdminEmail(email);

    if (!isEmailAdmin) {
      await requirePlatformAdminAal2();
    }

    const admin = supabaseAdmin();
    const { data, error } = await admin.rpc("rb_delete_shop_authoritative", {
      p_shop_id: shopId,
      p_confirm_name: confirmName,
      p_actor_user_id: user.id,
    });

    if (error) {
      const msg = error.message ?? "Failed";
      const lower = msg.toLowerCase();

      if (lower.includes("not authorized")) return NextResponse.json({ ok: false, error: msg }, { status: 403 });
      if (lower.includes("confirmation") || lower.includes("not found") || lower.includes("missing")) {
        return NextResponse.json({ ok: false, error: msg }, { status: 400 });
      }

      return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }

    return NextResponse.json({ ok: true, result: data ?? null }, { status: 200 });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    const status =
      /not authenticated/i.test(msg) ? 401 : /mfa required/i.test(msg) ? 403 : /not a platform admin/i.test(msg) ? 403 : /must be a uuid/i.test(msg) ? 400 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
