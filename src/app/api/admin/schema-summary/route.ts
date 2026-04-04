import { NextResponse } from "next/server";
import { requirePlatformAdminAal2 } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function getCount(admin: any, table: string) {
  const { count, error } = await admin.from(table).select("id", { count: "exact", head: true });
  if (error) return { ok: false, error: error.message, count: null };
  return { ok: true, count: count ?? 0 };
}

export async function GET(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    rateLimitOrThrow({ key: `admin:schema-summary:${ip}`, limit: 60, windowMs: 60_000 });

    const { user } = await requirePlatformAdminAal2();
    const admin = supabaseAdmin();

    const [shops, members, employees, devices, tokens, timeEvents, timeOff, messages] = await Promise.all([
      getCount(admin, "rb_shops"),
      getCount(admin, "rb_shop_members"),
      getCount(admin, "employees"),
      getCount(admin, "rb_devices"),
      getCount(admin, "rb_device_activation_tokens"),
      getCount(admin, "time_events"),
      getCount(admin, "time_off_requests"),
      getCount(admin, "messages"),
    ]);

    return NextResponse.json({
      ok: true,
      checked_at: new Date().toISOString(),
      platform_admin_user_id: user.id,
      env: {
        supabase_url_present: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        supabase_anon_present: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        supabase_service_role_present: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        supabase_db_url_present: !!process.env.SUPABASE_DB_URL,
      },
      tables: {
        rb_shops: shops,
        rb_shop_members: members,
        employees,
        rb_devices: devices,
        rb_device_activation_tokens: tokens,
        time_events: timeEvents,
        time_off_requests: timeOff,
        messages,
      },
    });
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
