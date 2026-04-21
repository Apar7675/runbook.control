import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireSessionUser } from "@/lib/desktopAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function text(v: any) {
  return String(v ?? "").trim();
}

function isLocalDesktopRequest(req: Request) {
  const host = text(req.headers.get("host")).toLowerCase();
  return host.includes("localhost") || host.includes("127.0.0.1");
}

function looksLikeUrl(value: string) {
  const lower = text(value).toLowerCase();
  return lower.startsWith("http://") || lower.startsWith("https://") || lower.startsWith("pack://");
}

async function ensureMembership(admin: any, shopId: string, userId: string) {
  const { data, error } = await admin
    .from("rb_shop_members")
    .select("shop_id, user_id, role")
    .eq("shop_id", shopId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.shop_id) throw new Error("Not authorized for this shop.");
  return data;
}

async function authorizeDesktop(req: Request, admin: any, shopId: string) {
  try {
    const { user } = await requireSessionUser(req);
    await ensureMembership(admin, shopId, user.id);
    return { mode: "user", userId: user.id } as const;
  } catch (error: any) {
    if (!isLocalDesktopRequest(req)) throw error;
    return { mode: "local-dev", userId: null } as const;
  }
}

async function createAvatarDisplayUrl(admin: any, path: string) {
  const cleanPath = text(path);
  if (!cleanPath) return "";
  if (looksLikeUrl(cleanPath)) return cleanPath;

  const { data, error } = await admin.storage.from("avatars").createSignedUrl(cleanPath, 60 * 60 * 24 * 30);
  if (error) return "";

  return text(data?.signedUrl);
}

export async function GET(req: NextRequest) {
  try {
    const admin = supabaseAdmin();
    const shopId = text(req.nextUrl.searchParams.get("shop_id"));

    if (!shopId) {
      return NextResponse.json({ ok: false, error: "shop_id required" }, { status: 400 });
    }

    const auth = await authorizeDesktop(req, admin, shopId);

    let employees: any[] = [];
    const modern = await admin
      .from("employees")
      .select("id, shop_id, auth_user_id, source_device_id, source_local_employee_id, employee_code, display_name, full_name, preferred_name, username, email, phone, department, job_title, company_name, status, home_address_1, home_address_2, home_city, home_state, home_postal_code, social_security_number, avatar_url_256, avatar_url_512, role, is_active, runbook_access_enabled, mobile_access_enabled, workstation_access_enabled, can_dashboard, can_po_entry, can_components, can_ballooning, can_inspection, can_gcoding, can_routing_db, can_work_orders, can_messaging, can_library, can_hr_department, can_settings, can_timeclock, can_dashboard_view, can_jobs_module, can_inspection_entry, can_camera_view, workstation_session_timeout_minutes, mobile_pin_salt_base64, mobile_pin_hash_base64")
      .eq("shop_id", shopId)
      .order("display_name", { ascending: true });

    if (!modern.error) {
      employees = modern.data || [];
    } else {
      const legacy = await admin
        .from("employees")
        .select("id, shop_id, employee_code, display_name, role, is_active")
        .eq("shop_id", shopId)
        .order("display_name", { ascending: true });

      if (legacy.error) throw new Error(legacy.error.message);

      employees = (legacy.data || []).map((employee: any) => ({
        ...employee,
        auth_user_id: null,
        full_name: text(employee.display_name),
        preferred_name: text(employee.display_name),
        username: "",
        email: "",
        phone: "",
        department: "",
        job_title: "",
        company_name: "",
        status: employee.is_active ? "Active" : "Inactive",
        home_address_1: "",
        home_address_2: "",
        home_city: "",
        home_state: "",
        home_postal_code: "",
        social_security_number: "",
        avatar_url_256: "",
        avatar_url_512: "",
        runbook_access_enabled: !!employee.is_active,
        mobile_access_enabled: !!employee.is_active,
        workstation_access_enabled: true,
        can_dashboard: false,
        can_po_entry: false,
        can_components: false,
        can_ballooning: false,
        can_inspection: false,
        can_gcoding: false,
        can_routing_db: false,
        can_work_orders: true,
        can_messaging: false,
        can_library: false,
        can_hr_department: false,
        can_settings: false,
        can_timeclock: true,
        can_dashboard_view: false,
        can_jobs_module: true,
        can_inspection_entry: false,
        can_camera_view: false,
        workstation_session_timeout_minutes: 30,
        mobile_pin_salt_base64: "",
        mobile_pin_hash_base64: text(employee.employee_code),
      }));
    }

    const rows = await Promise.all(
      (employees || []).map(async (employee: any) => {
        const avatar256 = text(employee.avatar_url_256);
        const avatar512 = text(employee.avatar_url_512);
        const displayUrl256 = avatar256
          ? await createAvatarDisplayUrl(admin, avatar256)
          : avatar512
            ? await createAvatarDisplayUrl(admin, avatar512)
            : "";

        return {
          id: text(employee.id),
          shop_id: text(employee.shop_id),
          auth_user_id: text(employee.auth_user_id),
          source_device_id: text(employee.source_device_id),
          source_local_employee_id: Number(employee.source_local_employee_id ?? 0) || 0,
          employee_code: text(employee.employee_code),
          display_name: text(employee.display_name),
          full_name: text(employee.full_name),
          preferred_name: text(employee.preferred_name),
          username: text(employee.username),
          email: text(employee.email),
          phone: text(employee.phone),
          department: text(employee.department),
          job_title: text(employee.job_title),
          company_name: text(employee.company_name),
          status: text(employee.status),
          home_address_1: text(employee.home_address_1),
          home_address_2: text(employee.home_address_2),
          home_city: text(employee.home_city),
          home_state: text(employee.home_state),
          home_postal_code: text(employee.home_postal_code),
          social_security_number: text(employee.social_security_number),
          avatar_url_256: avatar256,
          avatar_url_512: avatar512,
          avatar_display_url_256: displayUrl256,
          role: text(employee.role),
          is_active: !!employee.is_active,
          runbook_access_enabled: !!employee.runbook_access_enabled,
          mobile_access_enabled: !!employee.mobile_access_enabled,
          workstation_access_enabled: !!employee.workstation_access_enabled,
          can_dashboard: !!employee.can_dashboard,
          can_po_entry: !!employee.can_po_entry,
          can_components: !!employee.can_components,
          can_ballooning: !!employee.can_ballooning,
          can_inspection: !!employee.can_inspection,
          can_gcoding: !!employee.can_gcoding,
          can_routing_db: !!employee.can_routing_db,
          can_work_orders: !!employee.can_work_orders,
          can_messaging: !!employee.can_messaging,
          can_library: !!employee.can_library,
          can_hr_department: !!employee.can_hr_department,
          can_settings: !!employee.can_settings,
          can_timeclock: !!employee.can_timeclock,
          can_dashboard_view: !!employee.can_dashboard_view,
          can_jobs_module: !!employee.can_jobs_module,
          can_inspection_entry: !!employee.can_inspection_entry,
          can_camera_view: !!employee.can_camera_view,
          workstation_session_timeout_minutes: Number(employee.workstation_session_timeout_minutes ?? 15) || 15,
          mobile_pin_salt_base64: text(employee.mobile_pin_salt_base64),
          mobile_pin_hash_base64: text(employee.mobile_pin_hash_base64),
        };
      })
    );

    return NextResponse.json({
      ok: true,
      auth_mode: auth.mode,
      shop_id: shopId,
      employees: rows,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message ?? e) },
      { status: /authorized|authenticated/i.test(String(e?.message ?? e)) ? 401 : 500 }
    );
  }
}
