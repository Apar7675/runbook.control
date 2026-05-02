import { NextResponse } from "next/server";
import { assertUuid, requireShopAccessOrAdminAal2 } from "@/lib/authz";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function text(value: unknown) {
  return String(value ?? "").trim();
}

type DirectoryUser = {
  employee_id: string | null;
  auth_user_id: string | null;
  employee_code: string | null;
  display_name: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  employee_role: string | null;
  membership_role: string | null;
  membership_is_active: boolean;
  status: string | null;
  is_active: boolean;
  mobile_access_enabled: boolean;
  mobile_timeclock_enabled: boolean;
  mobile_timeclock_requires_review: boolean;
  workstation_access_enabled: boolean;
  runbook_access_enabled: boolean;
  created_at: string | null;
  membership_created_at: string | null;
  source: "employee" | "membership_only";
  trusted_device_count: number;
  trusted_recorded_at: string | null;
};

export async function GET(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    rateLimitOrThrow({ key: `admin:users:list:${ip}`, limit: 120, windowMs: 60_000 });

    const url = new URL(req.url);
    const shopId = text(url.searchParams.get("shop_id"));
    if (!shopId) return NextResponse.json({ ok: false, error: "Missing shop_id" }, { status: 400 });
    assertUuid("shop_id", shopId);

    const ctx = await requireShopAccessOrAdminAal2(shopId);
    const admin = supabaseAdmin();

    const [{ data: employeesRaw, error: employeeError }, { data: membersRaw, error: memberError }] = await Promise.all([
      admin
        .from("employees")
        .select("id,auth_user_id,employee_code,display_name,full_name,email,phone,role,status,is_active,mobile_access_enabled,mobile_timeclock_enabled,mobile_timeclock_requires_review,workstation_access_enabled,runbook_access_enabled,created_at")
        .eq("shop_id", shopId)
        .order("display_name", { ascending: true }),
      admin
        .from("rb_shop_members")
        .select("user_id,role,is_active,created_at")
        .eq("shop_id", shopId)
        .order("created_at", { ascending: true }),
    ]);

    if (employeeError) return NextResponse.json({ ok: false, error: employeeError.message }, { status: 500 });
    if (memberError) return NextResponse.json({ ok: false, error: memberError.message }, { status: 500 });

    const employees = (employeesRaw ?? []) as any[];
    const members = (membersRaw ?? []) as any[];

    const memberByUserId = new Map<string, any>();
    for (const member of members) {
      const userId = text(member?.user_id);
      if (!userId) continue;
      memberByUserId.set(userId, member);
    }

    const authUserIds = employees.map((employee) => text(employee?.auth_user_id)).filter(Boolean);
    const trustedDeviceRows = authUserIds.length
      ? await admin
          .from("rb_trusted_devices")
          .select("user_id,created_at")
          .in("user_id", authUserIds)
      : { data: [], error: null as any };

    if (trustedDeviceRows.error) return NextResponse.json({ ok: false, error: trustedDeviceRows.error.message }, { status: 500 });

    const trustedByUser = new Map<string, { count: number; trustedRecordedAt: string | null }>();
    for (const row of trustedDeviceRows.data ?? []) {
      const userId = text((row as any)?.user_id);
      const trustedRecordedAt = text((row as any)?.created_at) || null;
      if (!userId) continue;
      const current = trustedByUser.get(userId) ?? { count: 0, trustedRecordedAt: null };
      trustedByUser.set(userId, {
        count: current.count + 1,
        trustedRecordedAt:
          !current.trustedRecordedAt || (trustedRecordedAt && trustedRecordedAt > current.trustedRecordedAt)
            ? trustedRecordedAt
            : current.trustedRecordedAt,
      });
    }

    const users: DirectoryUser[] = employees.map((employee) => {
      const authUserId = text(employee?.auth_user_id) || null;
      const membership = authUserId ? memberByUserId.get(authUserId) : null;
      const trusted = authUserId ? trustedByUser.get(authUserId) : null;

      return {
        employee_id: text(employee?.id) || null,
        auth_user_id: authUserId,
        employee_code: text(employee?.employee_code) || null,
        display_name: text(employee?.display_name) || text(employee?.full_name) || text(employee?.email) || "Unnamed user",
        full_name: text(employee?.full_name) || null,
        email: text(employee?.email) || null,
        phone: text(employee?.phone) || null,
        employee_role: text(employee?.role) || null,
        membership_role: text(membership?.role) || null,
        membership_is_active: membership?.is_active !== false,
        status: text(employee?.status) || null,
        is_active: Boolean(employee?.is_active),
        mobile_access_enabled: Boolean(employee?.mobile_access_enabled),
        mobile_timeclock_enabled: Boolean(employee?.mobile_timeclock_enabled),
        mobile_timeclock_requires_review: Boolean(employee?.mobile_timeclock_requires_review),
        workstation_access_enabled: Boolean(employee?.workstation_access_enabled),
        runbook_access_enabled: Boolean(employee?.runbook_access_enabled),
        created_at: employee?.created_at ?? null,
        membership_created_at: membership?.created_at ?? null,
        source: "employee",
        trusted_device_count: trusted?.count ?? 0,
        trusted_recorded_at: trusted?.trustedRecordedAt ?? null,
      };
    });

    const employeeUserIds = new Set(users.map((row) => row.auth_user_id).filter(Boolean));
    const membershipOnlyUsers: DirectoryUser[] = members
      .filter((member) => {
        const userId = text(member?.user_id);
        return userId && !employeeUserIds.has(userId);
      })
      .map((member) => ({
        employee_id: null,
        auth_user_id: text(member?.user_id),
        employee_code: null,
        display_name: `Member ${text(member?.user_id).slice(0, 8)}`,
        full_name: null,
        email: null,
        phone: null,
        employee_role: null,
        membership_role: text(member?.role) || null,
        membership_is_active: member?.is_active !== false,
        status: null,
        is_active: false,
        mobile_access_enabled: false,
        mobile_timeclock_enabled: false,
        mobile_timeclock_requires_review: false,
        workstation_access_enabled: false,
        runbook_access_enabled: false,
        created_at: null,
        membership_created_at: member?.created_at ?? null,
        source: "membership_only",
        trusted_device_count: 0,
        trusted_recorded_at: null,
      }));

    const allUsers = [...users, ...membershipOnlyUsers];

    return NextResponse.json({
      ok: true,
      shop_id: shopId,
      admin: { is_platform_admin: ctx.isAdmin },
      summary: {
        member_count: members.length,
        employee_count: employees.length,
        active_employee_count: employees.filter((row) => Boolean(row?.is_active)).length,
        mobile_ready_count: employees.filter((row) => Boolean(row?.mobile_access_enabled)).length,
        workstation_ready_count: employees.filter((row) => Boolean(row?.workstation_access_enabled)).length,
        trusted_device_count: allUsers.reduce((sum, row) => sum + row.trusted_device_count, 0),
      },
      users: allUsers,
    });
  } catch (e: any) {
    const msg = e?.message ?? "Server error";
    const status =
      /not authenticated/i.test(msg) ? 401
      : /mfa required/i.test(msg) ? 403
      : /access denied/i.test(msg) ? 403
      : /must be a uuid/i.test(msg) ? 400
      : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
