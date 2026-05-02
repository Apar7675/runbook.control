import { NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit/writeAudit";
import { requireDesktopShopAdmin } from "@/lib/desktopShopAdminAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function text(value: unknown) {
  return String(value ?? "").trim();
}

function statusFor(message: string) {
  if (/not authenticated/i.test(message)) return 401;
  if (/access denied/i.test(message)) return 403;
  if (/uuid|missing/i.test(message)) return 400;
  return 500;
}

const SELECT = "id,shop_id,display_name,mobile_access_enabled,mobile_timeclock_enabled,mobile_timeclock_requires_review";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const shopId = text(url.searchParams.get("shop_id"));
    const employeeId = text(url.searchParams.get("employee_id"));
    if (!shopId) return NextResponse.json({ ok: false, error: "Missing shop_id" }, { status: 400 });
    if (!employeeId) return NextResponse.json({ ok: false, error: "Missing employee_id" }, { status: 400 });

    await requireDesktopShopAdmin(req, shopId);
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("employees")
      .select(SELECT)
      .eq("id", employeeId)
      .eq("shop_id", shopId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    const employee = data as any;
    if (!employee?.id) return NextResponse.json({ ok: false, error: "Employee not found for this shop" }, { status: 404 });
    return NextResponse.json({ ok: true, employee });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: statusFor(msg) });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const shopId = text((body as any).shop_id);
    const employeeId = text((body as any).employee_id);
    if (!shopId) return NextResponse.json({ ok: false, error: "Missing shop_id" }, { status: 400 });
    if (!employeeId) return NextResponse.json({ ok: false, error: "Missing employee_id" }, { status: 400 });

    const { user } = await requireDesktopShopAdmin(req, shopId);
    const patch = {
      mobile_timeclock_enabled: (body as any).mobile_timeclock_enabled === true,
      mobile_timeclock_requires_review: (body as any).mobile_timeclock_requires_review === true,
    };

    const admin = supabaseAdmin();
    const { data: current, error: currentError } = await admin
      .from("employees")
      .select(SELECT)
      .eq("id", employeeId)
      .eq("shop_id", shopId)
      .maybeSingle();

    if (currentError) throw new Error(currentError.message);
    const currentEmployee = current as any;
    if (!currentEmployee?.id) return NextResponse.json({ ok: false, error: "Employee not found for this shop" }, { status: 404 });

    const { data: updated, error: updateError } = await admin
      .from("employees")
      .update(patch)
      .eq("id", employeeId)
      .eq("shop_id", shopId)
      .select(SELECT)
      .single();

    if (updateError) throw new Error(updateError.message);

    await writeAudit({
      actor_user_id: user.id,
      actor_email: user.email ?? null,
      action: "desktop.employee.mobile_timeclock.updated",
      target_type: "employee",
      target_id: employeeId,
      shop_id: shopId,
      meta: { before: currentEmployee, after: updated },
    });

    return NextResponse.json({ ok: true, employee: updated });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: statusFor(msg) });
  }
}
