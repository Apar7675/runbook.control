import { NextResponse } from "next/server";
import { assertUuid, requirePlatformAdminAal2 } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    rateLimitOrThrow({ key: `admin:shop-summary:${ip}`, limit: 120, windowMs: 60_000 });

    await requirePlatformAdminAal2();

    const url = new URL(req.url);
    const shopId = String(url.searchParams.get("shop_id") ?? "").trim();
    if (!shopId) return NextResponse.json({ ok: false, error: "Missing shop_id" }, { status: 400 });
    assertUuid("shop_id", shopId);

    const admin = supabaseAdmin();

    const [shopRes, activeEmployeesRes, allEmployeesRes, membersRes, devicesRes, requestsRes, messagesRes] = await Promise.all([
      admin
        .from("rb_shops")
        .select("id,name,billing_status,billing_current_period_end,stripe_customer_id,stripe_subscription_id")
        .eq("id", shopId)
        .maybeSingle(),
      admin
        .from("employees")
        .select("id,employee_code,display_name,role,is_active,auth_user_id", { count: "exact" })
        .eq("shop_id", shopId)
        .eq("is_active", true)
        .order("display_name", { ascending: true })
        .limit(50),
      admin
        .from("employees")
        .select("id", { count: "exact", head: true })
        .eq("shop_id", shopId),
      admin
        .from("shop_members")
        .select("id,user_id,role,status,display_name", { count: "exact" })
        .eq("shop_id", shopId)
        .order("created_at", { ascending: false })
        .limit(50),
      admin
        .from("rb_devices")
        .select("id,name,status,device_type,created_at", { count: "exact" })
        .eq("shop_id", shopId)
        .order("created_at", { ascending: false })
        .limit(50),
      admin
        .from("time_off_requests")
        .select("id,status,type,start_date,end_date,employee_id", { count: "exact" })
        .eq("shop_id", shopId)
        .order("created_at", { ascending: false })
        .limit(25),
      admin
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("shop_id", shopId),
    ]);

    if (shopRes.error) return NextResponse.json({ ok: false, error: shopRes.error.message }, { status: 500 });
    if (!shopRes.data?.id) return NextResponse.json({ ok: false, error: "Shop not found" }, { status: 404 });
    if (activeEmployeesRes.error) return NextResponse.json({ ok: false, error: activeEmployeesRes.error.message }, { status: 500 });
    if (allEmployeesRes.error) return NextResponse.json({ ok: false, error: allEmployeesRes.error.message }, { status: 500 });
    if (membersRes.error) return NextResponse.json({ ok: false, error: membersRes.error.message }, { status: 500 });
    if (devicesRes.error) return NextResponse.json({ ok: false, error: devicesRes.error.message }, { status: 500 });
    if (requestsRes.error) return NextResponse.json({ ok: false, error: requestsRes.error.message }, { status: 500 });
    if (messagesRes.error) return NextResponse.json({ ok: false, error: messagesRes.error.message }, { status: 500 });

    const activeUserCount = activeEmployeesRes.count ?? (activeEmployeesRes.data ?? []).length;
    const totalEmployeeCount = allEmployeesRes.count ?? 0;
    const memberCount = membersRes.count ?? (membersRes.data ?? []).length;
    const deviceCount = devicesRes.count ?? (devicesRes.data ?? []).length;
    const timeOffRequestCount = requestsRes.count ?? (requestsRes.data ?? []).length;
    const messageCount = messagesRes.count ?? 0;
    const seatLimit = 20;

    return NextResponse.json({
      ok: true,
      checked_at: new Date().toISOString(),
      shop: shopRes.data,
      summary: {
        seat_limit: seatLimit,
        active_user_count: activeUserCount,
        seats_remaining: Math.max(0, seatLimit - activeUserCount),
        total_employee_count: totalEmployeeCount,
        shop_member_count: memberCount,
        device_count: deviceCount,
        time_off_request_count: timeOffRequestCount,
        message_count: messageCount,
      },
      active_employees: activeEmployeesRes.data ?? [],
      shop_members: membersRes.data ?? [],
      devices: devicesRes.data ?? [],
      recent_time_off_requests: requestsRes.data ?? [],
    });
  } catch (e: any) {
    const msg = e?.message ?? "Server error";
    const status =
      /not authenticated/i.test(msg) ? 401 :
      /mfa required/i.test(msg) ? 403 :
      /not a platform admin/i.test(msg) ? 403 :
      /must be a uuid/i.test(msg) ? 400 :
      500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
