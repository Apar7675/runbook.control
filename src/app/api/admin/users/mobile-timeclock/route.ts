import { NextResponse } from "next/server";
import { assertUuid } from "@/lib/authz";
import { writeAudit } from "@/lib/audit/writeAudit";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";
import { requireShopAdminOrPlatformAdmin } from "@/lib/shopAdminAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function text(value: unknown) {
  return String(value ?? "").trim();
}

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    rateLimitOrThrow({ key: `admin:users:mobile-timeclock:${ip}`, limit: 90, windowMs: 60_000 });

    const body = await req.json().catch(() => ({}));
    const shopId = text((body as any).shop_id);
    const employeeId = text((body as any).employee_id);
    if (!shopId) return NextResponse.json({ ok: false, error: "Missing shop_id" }, { status: 400 });
    if (!employeeId) return NextResponse.json({ ok: false, error: "Missing employee_id" }, { status: 400 });
    assertUuid("shop_id", shopId);
    assertUuid("employee_id", employeeId);

    const { user } = await requireShopAdminOrPlatformAdmin(shopId);
    const patch = {
      mobile_timeclock_enabled: (body as any).mobile_timeclock_enabled === true,
      mobile_timeclock_requires_review: (body as any).mobile_timeclock_requires_review === true,
    };

    const admin = supabaseAdmin();
    const { data: current, error: currentError } = await admin
      .from("employees")
      .select("id,shop_id,display_name,mobile_access_enabled,mobile_timeclock_enabled,mobile_timeclock_requires_review")
      .eq("id", employeeId)
      .eq("shop_id", shopId)
      .maybeSingle();

    if (currentError) throw new Error(currentError.message);
    if (!current?.id) return NextResponse.json({ ok: false, error: "Employee not found for this shop" }, { status: 404 });

    const { data: updated, error: updateError } = await admin
      .from("employees")
      .update(patch)
      .eq("id", employeeId)
      .eq("shop_id", shopId)
      .select("id,shop_id,display_name,mobile_access_enabled,mobile_timeclock_enabled,mobile_timeclock_requires_review")
      .single();

    if (updateError) throw new Error(updateError.message);

    await writeAudit({
      actor_user_id: user.id,
      actor_email: user.email ?? null,
      action: "employee.mobile_timeclock.updated",
      target_type: "employee",
      target_id: employeeId,
      shop_id: shopId,
      meta: { before: current, after: updated },
    });

    return NextResponse.json({ ok: true, employee: updated });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    const status =
      /not authenticated/i.test(msg) ? 401 :
      /mfa required|access denied/i.test(msg) ? 403 :
      /uuid|missing/i.test(msg) ? 400 :
      500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
