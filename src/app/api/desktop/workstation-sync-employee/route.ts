import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/desktopAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { assertUuid } from "@/lib/authz";
import { getShopEntitlement } from "@/lib/billing/entitlement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function s(v: any) {
  return String(v ?? "").trim();
}

function b(v: any, def = false) {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  const x = String(v ?? "").trim().toLowerCase();
  if (!x) return def;
  return x === "1" || x === "true" || x === "yes" || x === "y";
}

function n(v: any, def: number, min: number, max: number) {
  const raw = Number(v);
  if (!Number.isFinite(raw)) return def;
  const value = Math.trunc(raw);
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function toEmployeeRole(input: string) {
  const role = s(input).toLowerCase();
  if (!role) return "employee";
  if (["owner", "admin", "manager", "foreman"].includes(role)) return "foreman";
  return "employee";
}

async function getShopMembership(admin: any, shopId: string, userId: string) {
  const { data, error } = await admin
    .from("rb_shop_members")
    .select("id")
    .eq("shop_id", shopId)
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error("Access denied");
}

async function findEmployee(
  admin: any,
  shopId: string,
  remoteEmployeeId: string,
  sourceDeviceId: string,
  sourceLocalEmployeeId: number | null,
  employeeCode: string
) {
  if (remoteEmployeeId) {
    const { data, error } = await admin
      .from("employees")
      .select("id")
      .eq("shop_id", shopId)
      .eq("id", remoteEmployeeId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (data?.id) return data;
  }

  if (sourceDeviceId && sourceLocalEmployeeId && sourceLocalEmployeeId > 0) {
    const { data, error } = await admin
      .from("employees")
      .select("id")
      .eq("shop_id", shopId)
      .eq("source_device_id", sourceDeviceId)
      .eq("source_local_employee_id", sourceLocalEmployeeId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (data?.id) return data;
  }

  if (employeeCode) {
    const { data, error } = await admin
      .from("employees")
      .select("id")
      .eq("shop_id", shopId)
      .eq("employee_code", employeeCode)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (data?.id) return data;
  }

  return null;
}

export async function POST(req: Request) {
  try {
    const { user } = await requireSessionUser(req);
    const body = await req.json().catch(() => ({}));

    const shopId = s((body as any).shop_id);
    const remoteEmployeeId = s((body as any).remote_employee_id);
    const sourceDeviceId = s((body as any).source_device_id);
    const sourceLocalEmployeeIdRaw = Number((body as any).source_local_employee_id);
    const sourceLocalEmployeeId = Number.isFinite(sourceLocalEmployeeIdRaw) && sourceLocalEmployeeIdRaw > 0
      ? Math.trunc(sourceLocalEmployeeIdRaw)
      : null;
    const employeeCode = s((body as any).employee_code);
    const displayName = s((body as any).display_name);
    const role = toEmployeeRole((body as any).role);
    const status = s((body as any).status) || "Active";

    if (!shopId) return NextResponse.json({ ok: false, error: "Missing shop_id" }, { status: 400 });
    if (!employeeCode) return NextResponse.json({ ok: false, error: "employee_code required" }, { status: 400 });
    if (!displayName) return NextResponse.json({ ok: false, error: "display_name required" }, { status: 400 });

    assertUuid("shop_id", shopId);
    if (remoteEmployeeId) assertUuid("remote_employee_id", remoteEmployeeId);

    const admin = supabaseAdmin();
    await getShopMembership(admin, shopId, user.id);

    const entitlement = await getShopEntitlement(shopId);
    if (!entitlement.allowed || entitlement.restricted) {
      return NextResponse.json({ ok: false, error: entitlement.reason, entitlement }, { status: 402 });
    }

    const existing = await findEmployee(admin, shopId, remoteEmployeeId, sourceDeviceId, sourceLocalEmployeeId, employeeCode);
    if (!existing?.id) {
      return NextResponse.json(
        {
          ok: false,
          error: "Employee must be provisioned from Desktop HR before workstation policy can sync.",
        },
        { status: 409 }
      );
    }

    const patch = {
      shop_id: shopId,
      employee_code: employeeCode,
      display_name: displayName,
      role,
      is_active: /^active$/i.test(status),
      mobile_pin_salt_base64: s((body as any).mobile_pin_salt_base64),
      mobile_pin_hash_base64: s((body as any).mobile_pin_hash_base64),
      workstation_access_enabled: b((body as any).workstation_access_enabled, false),
      can_timeclock: b((body as any).can_timeclock, false),
      can_dashboard_view: b((body as any).can_dashboard_view, false),
      can_jobs_module: b((body as any).can_jobs_module, false),
      can_inspection_entry: b((body as any).can_inspection_entry, false),
      can_camera_view: b((body as any).can_camera_view, false),
      workstation_session_timeout_minutes: n((body as any).workstation_session_timeout_minutes, 15, 1, 480),
    };

    const { data, error } = await admin
      .from("employees")
      .update(patch)
      .eq("id", existing.id)
      .select("id,shop_id,employee_code,display_name,role,is_active,workstation_access_enabled,can_timeclock,can_dashboard_view,can_jobs_module,can_inspection_entry,can_camera_view,workstation_session_timeout_minutes")
      .single();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, employee: data, entitlement });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    const status = /not authenticated/i.test(msg) ? 401 : /access denied/i.test(msg) ? 403 : /must be a uuid/i.test(msg) ? 400 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
