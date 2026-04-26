import crypto from "crypto";
import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/desktopAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getShopEntitlement } from "@/lib/billing/entitlement";
import { describeShopAccess } from "@/lib/billing/access";
import { formatCleanupResponse, loadPendingCleanup } from "@/lib/control/cleanup";
import { WorkstationModule, signWorkstationSession } from "@/lib/workstationAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function s(v: any) {
  return String(v ?? "").trim();
}

function hashPin(pin: string, saltBase64: string) {
  const salt = Buffer.from(saltBase64, "base64");
  const pinBytes = Buffer.from(pin, "utf8");
  const combined = Buffer.concat([salt, pinBytes]);
  return crypto.createHash("sha256").update(combined).digest("base64");
}

function modulesForEmployee(employee: any): WorkstationModule[] {
  const modules: WorkstationModule[] = [];
  if (employee?.can_timeclock) modules.push("timeclock");
  if (employee?.can_dashboard_view) modules.push("dashboard");
  if (employee?.can_jobs_module) modules.push("jobs");
  if (employee?.can_inspection_entry) modules.push("inspection");
  if (employee?.can_camera_view) modules.push("camera");
  return modules;
}

function roleIncludes(employee: any, value: string) {
  return s(employee?.role).toLowerCase().includes(value);
}

function codeIs(employee: any, ...codes: string[]) {
  const code = s(employee?.employee_code).toLowerCase();
  return codes.some(candidate => candidate.toLowerCase() === code);
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

async function requireActiveWorkstation(admin: any, shopId: string, workstationId: string) {
  const { data, error } = await admin
    .from("rb_devices")
    .select("id,shop_id,status,device_type,name")
    .eq("id", workstationId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error("Workstation not registered.");
  if (String(data.shop_id ?? "").trim() !== shopId) throw new Error("Workstation not registered for this shop.");
  if (String(data.device_type ?? "").trim().toLowerCase() !== "workstation") throw new Error("Device is not a workstation.");
  if (String(data.status ?? "").trim().toLowerCase() !== "active") throw new Error("Workstation is disabled.");
  return data;
}

async function loadMatchingEmployee(admin: any, shopId: string, passcode: string) {
  const modern = await admin
    .from("employees")
    .select("id,shop_id,employee_code,display_name,role,is_active,workstation_access_enabled,can_timeclock,can_dashboard_view,can_jobs_module,can_inspection_entry,can_camera_view,workstation_session_timeout_minutes,mobile_pin_salt_base64,mobile_pin_hash_base64")
    .eq("shop_id", shopId)
    .eq("workstation_access_enabled", true)
    .eq("is_active", true);

  if (!modern.error) {
    for (const employee of modern.data ?? []) {
      const salt = s((employee as any).mobile_pin_salt_base64);
      const hash = s((employee as any).mobile_pin_hash_base64);
      if (!salt || !hash) continue;
      if (hashPin(passcode, salt) === hash) return employee;
    }

    return null;
  }

  const legacy = await admin
    .from("employees")
    .select("id,shop_id,employee_code,display_name,role,is_active")
    .eq("shop_id", shopId)
    .eq("is_active", true);

  if (legacy.error) throw new Error(legacy.error.message);

  for (const employee of legacy.data ?? []) {
    if (s((employee as any).employee_code).toLowerCase() === passcode.trim().toLowerCase()) {
      const qcRole = roleIncludes(employee, "qc") || roleIncludes(employee, "inspection");
      const supervisorRole =
        roleIncludes(employee, "supervisor") ||
        roleIncludes(employee, "planner") ||
        roleIncludes(employee, "manager") ||
        roleIncludes(employee, "lead");
      const techRole = roleIncludes(employee, "tech") || roleIncludes(employee, "maintenance");
      const inspectionDemoAccess = codeIs(employee, "4103", "4111", "4119");
      const dashboardDemoAccess = codeIs(employee, "4104", "4106", "4112", "4116", "4120");
      const cameraDemoAccess = codeIs(employee, "4105", "4115");

      return {
        ...employee,
        workstation_access_enabled: true,
        can_timeclock: true,
        can_dashboard_view: supervisorRole || dashboardDemoAccess,
        can_jobs_module: true,
        can_inspection_entry: qcRole || inspectionDemoAccess,
        can_camera_view: techRole || cameraDemoAccess,
        workstation_session_timeout_minutes: 30,
      };
    }
  }

  return null;
}

async function loadRecentPunches(admin: any, shopId: string, employeeId: string) {
  const { data, error } = await admin
    .from("time_events")
    .select("id,employee_id,shop_id,event_type,client_ts,server_ts,created_at,source,device_id,offline_id,note,is_offline")
    .eq("shop_id", shopId)
    .eq("employee_id", employeeId)
    .order("client_ts", { ascending: false })
    .limit(12);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row: any) => ({
    id: s(row.id),
    employee_id: s(row.employee_id),
    shop_id: s(row.shop_id),
    event_type: s(row.event_type),
    client_ts: s(row.client_ts),
    server_ts: s(row.server_ts) || s(row.created_at),
    source: s(row.source),
    device_id: s(row.device_id),
    offline_id: s(row.offline_id),
    note: s(row.note),
    is_offline: !!row.is_offline,
  }));
}

export async function POST(req: Request) {
  try {
    const { user } = await requireSessionUser(req);
    const body = await req.json().catch(() => ({}));
    const shop_id = s((body as any).shop_id);
    const workstation_id = s((body as any).workstation_id);
    const passcode = s((body as any).passcode);

    if (!shop_id) return NextResponse.json({ ok: false, error: "Missing shop_id" }, { status: 400 });
    if (!workstation_id) return NextResponse.json({ ok: false, error: "Missing workstation_id" }, { status: 400 });
    if (!passcode) return NextResponse.json({ ok: false, error: "Passcode required" }, { status: 400 });

    const admin = supabaseAdmin();
    const pendingCleanup = await loadPendingCleanup({
      shopId: shop_id,
      deviceId: workstation_id,
      targetApps: ["workstation"],
    });

    if (pendingCleanup.preferred) {
      return NextResponse.json(
        {
          ok: false,
          error: "Cleanup required",
          cleanup_required: true,
          cleanup: formatCleanupResponse(pendingCleanup.preferred),
        },
        { status: 410 }
      );
    }

    await getShopMembership(admin, shop_id, user.id);
    const workstation = await requireActiveWorkstation(admin, shop_id, workstation_id);
    const access = describeShopAccess(await getShopEntitlement(shop_id));
    if (access.workstation_mode !== "full") {
      return NextResponse.json({ ok: false, error: access.summary, access }, { status: 402 });
    }
    const employee = await loadMatchingEmployee(admin, shop_id, passcode);

    if (!employee?.id) {
      return NextResponse.json({ ok: false, error: "Passcode not recognized." }, { status: 401 });
    }

    const modules = modulesForEmployee(employee);
    const timeoutMinutes = Math.max(1, Math.min(480, Number((employee as any).workstation_session_timeout_minutes ?? 15) || 15));
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + timeoutMinutes * 60 * 1000);
    const token = signWorkstationSession({
      shop_id,
      workstation_id,
      employee_id: s((employee as any).id),
      display_name: s((employee as any).display_name),
      role: s((employee as any).role),
      modules,
      issued_at_utc: issuedAt.toISOString(),
      expires_at_utc: expiresAt.toISOString(),
    });

    const recent_punches = modules.includes("timeclock") ? await loadRecentPunches(admin, shop_id, s((employee as any).id)) : [];

    return NextResponse.json({
      ok: true,
      workstation: {
        id: s((workstation as any).id),
        shop_id,
        name: s((workstation as any).name),
        status: s((workstation as any).status),
      },
      employee: {
        id: s((employee as any).id),
        shop_id,
        employee_code: s((employee as any).employee_code),
        display_name: s((employee as any).display_name),
        role: s((employee as any).role),
      },
      capabilities: {
        modules,
        session_timeout_minutes: timeoutMinutes,
      },
      access,
      session: {
        token,
        issued_at_utc: issuedAt.toISOString(),
        expires_at_utc: expiresAt.toISOString(),
      },
      recent_punches,
    });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    const status = /not authenticated/i.test(msg) ? 401 : /access denied/i.test(msg) ? 403 : /passcode/i.test(msg) ? 401 : 400;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

