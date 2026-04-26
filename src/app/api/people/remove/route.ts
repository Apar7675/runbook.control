import { NextResponse } from "next/server";
import { assertUuid, isPlatformAdmin, requireAal2 } from "@/lib/authz";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    rateLimitOrThrow({ key: `people:remove:${ip}`, limit: 60, windowMs: 60_000 });

    const body = await req.json().catch(() => ({}));
    const shopId = String((body as any)?.shopId ?? "").trim();
    const employeeId = String((body as any)?.employeeId ?? "").trim();

    if (!shopId) return NextResponse.json({ ok: false, error: "Missing shopId" }, { status: 400 });
    if (!employeeId) return NextResponse.json({ ok: false, error: "Missing employeeId" }, { status: 400 });

    assertUuid("shopId", shopId);
    assertUuid("employeeId", employeeId);

    const { user } = await requireAal2();
    const admin = supabaseAdmin();

    let authorized = await isPlatformAdmin(user.id);

    if (!authorized) {
      const { data: member, error: memberError } = await admin
        .from("rb_shop_members")
        .select("id,role")
        .eq("shop_id", shopId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (memberError) {
        return NextResponse.json({ ok: false, error: memberError.message }, { status: 500 });
      }

      const role = String(member?.role ?? "").trim().toLowerCase();
      authorized = !!member?.id && (role === "owner" || role === "admin");
    }

    if (!authorized) {
      return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
    }

    const { data, error } = await admin.rpc("rb_disable_employee_authoritative", {
      p_shop_id: shopId,
      p_employee_id: employeeId,
      p_actor_user_id: user.id,
    });

    if (error) {
      const msg = error.message ?? "Failed";
      const lower = msg.toLowerCase();

      if (lower.includes("not found") || lower.includes("missing")) {
        return NextResponse.json({ ok: false, error: msg }, { status: 400 });
      }

      if (lower.includes("cannot remove") || lower.includes("access denied")) {
        return NextResponse.json({ ok: false, error: msg }, { status: 403 });
      }

      return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }

    return NextResponse.json({ ok: true, result: data ?? null }, { status: 200 });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    const status =
      /not authenticated/i.test(msg) ? 401
      : /mfa required/i.test(msg) ? 403
      : /access denied/i.test(msg) ? 403
      : /must be a uuid/i.test(msg) ? 400
      : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
