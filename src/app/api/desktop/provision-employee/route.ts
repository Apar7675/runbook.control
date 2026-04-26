import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/desktopAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { assertUuid } from "@/lib/authz";
import { getShopEntitlement } from "@/lib/billing/entitlement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProvisionMode =
  | "create_auth_user"
  | "link_existing_auth_user"
  | "create_employee_only"
  | "update_employee_only"
  | "disable_mobile_access"
  | "repair_auth_by_email";

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

function normalizeRequestedRole(input: string) {
  const role = s(input).toLowerCase();
  if (!role) return "employee";
  if (role === "owner") return "owner";
  if (role === "admin") return "admin";
  if (role === "manager") return "manager";
  if (role === "foreman") return "foreman";
  if (role === "viewer") return "viewer";
  if (role === "qc" || role === "operator" || role === "programmer" || role === "office") return "employee";
  return "employee";
}

function toShopMemberRole(requestedRole: string) {
  if (requestedRole === "owner") return "owner";
  if (requestedRole === "admin" || requestedRole === "manager" || requestedRole === "foreman") return "admin";
  return "member";
}

function toEmployeeRole(requestedRole: string) {
  return requestedRole === "owner" || requestedRole === "admin" || requestedRole === "manager" || requestedRole === "foreman"
    ? "foreman"
    : "employee";
}

function toActiveStatus(input: string) {
  const status = s(input).toLowerCase();
  return status === "" || status === "active";
}

function defaultIncludedSeats() {
  const raw = s(process.env.RUNBOOK_DEFAULT_INCLUDED_USER_SEATS);
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 20;
  return Math.trunc(n);
}

function defaultBasicEmployeeLimit() {
  const raw = s(process.env.RUNBOOK_EMPLOYEE_LIMIT_BASIC);
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 20;
  return Math.trunc(n);
}

function defaultProEmployeeLimit() {
  const raw = s(process.env.RUNBOOK_EMPLOYEE_LIMIT_PRO);
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.trunc(n);
}

function getEmployeeLimitForPlan(subscriptionPlan: string) {
  const normalized = s(subscriptionPlan).toLowerCase();
  if (normalized === "pro" || normalized === "pro_monthly" || normalized === "pro_annual" || normalized === "unlimited") {
    return defaultProEmployeeLimit();
  }

  return defaultBasicEmployeeLimit();
}

function makeAuthEmail(params: { shopId: string; email: string; username: string; employeeCode: string }) {
  const email = s(params.email).toLowerCase();
  if (email) return email;

  const base = s(params.username) || s(params.employeeCode) || "employee";
  const safe = base.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "employee";
  return `${safe}+${params.shopId}@runbook.local`;
}

function cleanAvatarValue(value: string) {
  const clean = s(value);
  return clean || null;
}

function toLocalEmployeeId(value: any) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const whole = Math.trunc(n);
  return whole > 0 ? whole : null;
}

function isEmailAlreadyRegistered(message: string) {
  const text = s(message).toLowerCase();
  return text.includes("already been registered") || text.includes("already registered") || text.includes("user already registered");
}

async function getShopMembership(admin: any, shopId: string, userId: string) {
  const { data, error } = await admin
    .from("rb_shop_members")
    .select("id, role")
    .eq("shop_id", shopId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error("Access denied");
  return data;
}

async function getSeatInfo(admin: any, shopId: string) {
  const baseIncludedSeats = defaultIncludedSeats();
  const baseEmployeeLimit = defaultBasicEmployeeLimit();

  const { data: rich, error: richErr } = await admin
    .from("rb_shops")
    .select("id,included_user_seats,purchased_extra_user_seats,subscription_plan")
    .eq("id", shopId)
    .maybeSingle();

  if (!richErr && rich?.id) {
    const included = Number((rich as any).included_user_seats ?? baseIncludedSeats);
    const extra = Number((rich as any).purchased_extra_user_seats ?? 0);
    const subscriptionPlan = s((rich as any).subscription_plan);
    return {
      includedUserSeats: Number.isFinite(included) ? Math.trunc(included) : baseIncludedSeats,
      purchasedExtraUserSeats: Number.isFinite(extra) ? Math.trunc(extra) : 0,
      subscriptionPlan,
      employeeLimit: getEmployeeLimitForPlan(subscriptionPlan) ?? baseEmployeeLimit,
      usedFallbackSeatFields: false,
    };
  }

  return {
    includedUserSeats: baseIncludedSeats,
    purchasedExtraUserSeats: 0,
    subscriptionPlan: "",
    employeeLimit: baseEmployeeLimit,
    usedFallbackSeatFields: true,
  };
}

async function countActiveLicensedUsers(admin: any, shopId: string) {
  const { count, error } = await admin
    .from("employees")
    .select("id", { count: "exact", head: true })
    .eq("shop_id", shopId)
    .eq("is_active", true)
    .not("auth_user_id", "is", null);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function countEmployeesForShop(admin: any, shopId: string) {
  const { count, error } = await admin
    .from("employees")
    .select("id", { count: "exact", head: true })
    .eq("shop_id", shopId);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function findAuthUserByEmail(admin: any, email: string) {
  const normalized = s(email).toLowerCase();
  if (!normalized) return null;

  for (let page = 1; page <= 25; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);

    const users = (data as any)?.users || [];
    const match = users.find((user: any) => s(user?.email).toLowerCase() === normalized);
    if (match) {
      return {
        id: s(match.id),
        email: s(match.email).toLowerCase(),
      };
    }

    if (users.length < 200)
      break;
  }

  return null;
}

async function findExistingEmployee(admin: any, args: {
  shopId: string;
  remoteEmployeeId: string;
  authUserId: string;
  employeeCode: string;
  email: string;
  sourceDeviceId: string;
  sourceLocalEmployeeId: number | null;
}) {
  const selectFields = "id,shop_id,auth_user_id,employee_code,display_name,email,role,is_active,source_device_id,source_local_employee_id";

  if (args.remoteEmployeeId) {
    const { data, error } = await admin
      .from("employees")
      .select(selectFields)
      .eq("shop_id", args.shopId)
      .eq("id", args.remoteEmployeeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return data;
  }

  if (args.sourceDeviceId && args.sourceLocalEmployeeId !== null) {
    const { data, error } = await admin
      .from("employees")
      .select(selectFields)
      .eq("shop_id", args.shopId)
      .eq("source_device_id", args.sourceDeviceId)
      .eq("source_local_employee_id", args.sourceLocalEmployeeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return data;
  }

  if (args.email) {
    const { data, error } = await admin
      .from("employees")
      .select(selectFields)
      .eq("shop_id", args.shopId)
      .eq("email", args.email)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return data;
  }

  if (args.authUserId) {
    const { data, error } = await admin
      .from("employees")
      .select(selectFields)
      .eq("shop_id", args.shopId)
      .eq("auth_user_id", args.authUserId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return data;
  }

  if (args.employeeCode) {
    const { data, error } = await admin
      .from("employees")
      .select(selectFields)
      .eq("shop_id", args.shopId)
      .eq("employee_code", args.employeeCode)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return data;
  }

  return null;
}

async function findEmployeeByAuthUserId(admin: any, shopId: string, authUserId: string) {
  const id = s(authUserId);
  if (!id) return null;

  const { data, error } = await admin
    .from("employees")
    .select("id,shop_id,auth_user_id,employee_code,display_name,email,role,is_active,source_device_id,source_local_employee_id")
    .eq("shop_id", shopId)
    .eq("auth_user_id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ?? null;
}

async function upsertShopMember(admin: any, args: {
  shopId: string;
  userId: string;
  role: string;
}) {
  const desiredRole = toShopMemberRole(args.role);

  const { data: existing, error: lookupErr } = await admin
    .from("rb_shop_members")
    .select("id")
    .eq("shop_id", args.shopId)
    .eq("user_id", args.userId)
    .maybeSingle();

  if (lookupErr) throw new Error(lookupErr.message);

  if ((existing as any)?.id) {
    const { error: updateErr } = await admin
      .from("rb_shop_members")
      .update({ role: desiredRole })
      .eq("id", (existing as any).id);

    if (updateErr) throw new Error(updateErr.message);
    return;
  }

  const { error: insertErr } = await admin
    .from("rb_shop_members")
    .insert({
      shop_id: args.shopId,
      user_id: args.userId,
      role: desiredRole,
    });

  if (insertErr) throw new Error(insertErr.message);
}

export async function POST(req: Request) {
  try {
    const { user } = await requireSessionUser(req);
    const body = await req.json().catch(() => ({}));

    const shopId = s((body as any).shop_id);
    const localEmployeeIdRaw = (body as any).local_employee_id;
    const localEmployeeId = toLocalEmployeeId(localEmployeeIdRaw);
    const sourceDeviceId = s((body as any).source_device_id);
    const remoteEmployeeId = s((body as any).remote_employee_id);
    let authUserId = s((body as any).auth_user_id);
    const employeeCode = s((body as any).employee_code);
    const displayName = s((body as any).display_name);
    const fullName = s((body as any).full_name);
    const preferredName = s((body as any).preferred_name);
    const email = s((body as any).email).toLowerCase();
    const username = s((body as any).username);
    const phone = s((body as any).phone);
    const department = s((body as any).department);
    const jobTitle = s((body as any).job_title);
    const companyName = s((body as any).company_name);
    const homeAddress1 = s((body as any).home_address_1);
    const homeAddress2 = s((body as any).home_address_2);
    const homeCity = s((body as any).home_city);
    const homeState = s((body as any).home_state);
    const homePostalCode = s((body as any).home_postal_code);
    const socialSecurityNumber = s((body as any).social_security_number);
    const requestedRole = normalizeRequestedRole((body as any).role);
    const status = s((body as any).status) || "Active";
    const runBookAccessEnabled = b((body as any).runbook_access_enabled, true);
    const mobileAccessEnabled = b((body as any).mobile_access_enabled, true);
    const workstationAccessEnabled = b((body as any).workstation_access_enabled, false);
    const canDashboard = b((body as any).can_dashboard, false);
    const canPoEntry = b((body as any).can_po_entry, false);
    const canComponents = b((body as any).can_components, false);
    const canBallooning = b((body as any).can_ballooning, false);
    const canInspection = b((body as any).can_inspection, false);
    const canGCoding = b((body as any).can_gcoding, false);
    const canRoutingDb = b((body as any).can_routing_db, false);
    const canWorkOrders = b((body as any).can_work_orders, true);
    const canMessaging = b((body as any).can_messaging, false);
    const canLibrary = b((body as any).can_library, false);
    const canHrDepartment = b((body as any).can_hr_department, false);
    const canSettings = b((body as any).can_settings, false);
    const canTimeClock = b((body as any).can_timeclock, false);
    const canDashboardView = b((body as any).can_dashboard_view, false);
    const canJobsModule = b((body as any).can_jobs_module, false);
    const canInspectionEntry = b((body as any).can_inspection_entry, false);
    const canCameraView = b((body as any).can_camera_view, false);
    const workstationSessionTimeoutMinutes = Math.max(1, Number((body as any).workstation_session_timeout_minutes ?? 15) || 15);
    const mobilePinSaltBase64 = s((body as any).mobile_pin_salt_base64);
    const mobilePinHashBase64 = s((body as any).mobile_pin_hash_base64);
    const avatarUrl256 = cleanAvatarValue(s((body as any).avatar_url_256));
    const avatarUrl512 = cleanAvatarValue(s((body as any).avatar_url_512));
    const temporaryPassword = s((body as any).temporary_password);
    const requestedMode = s((body as any).provision_mode) as ProvisionMode;
    const provisionMode: ProvisionMode =
      requestedMode === "link_existing_auth_user" ||
      requestedMode === "create_employee_only" ||
      requestedMode === "update_employee_only" ||
      requestedMode === "disable_mobile_access" ||
      requestedMode === "repair_auth_by_email"
        ? requestedMode
        : "create_auth_user";

    if (!shopId) return NextResponse.json({ ok: false, error: "Missing shop_id" }, { status: 400 });
    assertUuid("shop_id", shopId);

    if (!displayName) {
      return NextResponse.json({ ok: false, error: "display_name required" }, { status: 400 });
    }

    if (!employeeCode) {
      return NextResponse.json({ ok: false, error: "employee_code required" }, { status: 400 });
    }

    if (authUserId) assertUuid("auth_user_id", authUserId);
    if (remoteEmployeeId) assertUuid("remote_employee_id", remoteEmployeeId);

    const admin = supabaseAdmin();
    await getShopMembership(admin, shopId, user.id);

    const entitlement = await getShopEntitlement(shopId);
    if (!entitlement.allowed || entitlement.restricted) {
      return NextResponse.json({ ok: false, error: entitlement.reason, entitlement }, { status: 402 });
    }

    const authEmail = makeAuthEmail({ shopId, email, username, employeeCode });
    const shouldManageAuth =
      provisionMode === "create_auth_user" ||
      provisionMode === "link_existing_auth_user" ||
      provisionMode === "repair_auth_by_email";

    let authAction = shouldManageAuth ? "auth_pending" : "auth_not_requested";
    let authMessage = shouldManageAuth ? "Auth provisioning pending." : "Auth provisioning not requested.";
    let needsAuthRepair = false;

    if (shouldManageAuth && !authUserId) {
      const existingAuthUser = await findAuthUserByEmail(admin, authEmail);
      if (existingAuthUser?.id) {
        authUserId = existingAuthUser.id;
        authAction = "reused_existing_auth_user";
            authMessage = `Existing auth user reused for ${authEmail}.`;
      } else if (provisionMode === "repair_auth_by_email" || provisionMode === "link_existing_auth_user") {
        authAction = "auth_skipped_no_existing_user";
        authMessage = `No existing auth user found for ${authEmail}. Employee profile sync will continue without auth/mobile.`;
      }
    } else if (shouldManageAuth && authUserId) {
      authAction = provisionMode === "repair_auth_by_email" ? "auth_repaired" : "linked_existing_auth_user";
      authMessage = provisionMode === "repair_auth_by_email"
        ? `Auth link repaired using existing auth user ${authUserId}.`
        : `Existing auth user ${authUserId} will be linked.`;
    }

    let existingEmployee = await findExistingEmployee(admin, {
      shopId,
      remoteEmployeeId,
      authUserId,
      employeeCode,
      email,
      sourceDeviceId,
      sourceLocalEmployeeId: localEmployeeId,
    });

    const shopInfo = await getSeatInfo(admin, shopId);
    const desiredActive = provisionMode === "disable_mobile_access" ? false : toActiveStatus(status);
    const hadLicensedAuth = !!(existingEmployee as any)?.auth_user_id && !!(existingEmployee as any)?.is_active;
    const willAttemptAuthLinkOrCreate = shouldManageAuth && (!!authUserId || provisionMode === "create_auth_user");
    const effectiveSeatLimit = Math.max(0, shopInfo.includedUserSeats + shopInfo.purchasedExtraUserSeats);
    const activeUserCount = await countActiveLicensedUsers(admin, shopId);
    const existingEmployeeCount = existingEmployee ? null : await countEmployeesForShop(admin, shopId);
    const willConsumeNewSeat = desiredActive && willAttemptAuthLinkOrCreate && !hadLicensedAuth;

    if (!existingEmployee && shopInfo.employeeLimit !== null && existingEmployeeCount !== null && existingEmployeeCount >= shopInfo.employeeLimit) {
      return NextResponse.json(
        {
          ok: false,
          error: `Maximum of ${shopInfo.employeeLimit} employees reached for this plan.`,
          error_code: "limit_exceeded",
          employee_limit: shopInfo.employeeLimit,
          employee_count: existingEmployeeCount,
          subscription_plan: shopInfo.subscriptionPlan,
          entitlement,
        },
        { status: 409 }
      );
    }

    if (willConsumeNewSeat && activeUserCount >= effectiveSeatLimit) {
      return NextResponse.json(
        {
          ok: false,
          error: "No available user seats. Buy more seats or deactivate another user first.",
          error_code: "seat_limit_exceeded",
          seat_limit: effectiveSeatLimit,
          active_user_count: activeUserCount,
          seats_remaining: Math.max(0, effectiveSeatLimit - activeUserCount),
          used_fallback_seat_fields: shopInfo.usedFallbackSeatFields,
        },
        { status: 409 }
      );
    }

    if (provisionMode === "create_auth_user" && !authUserId) {
      if (!temporaryPassword) {
        return NextResponse.json(
          { ok: false, error: "temporary_password required when creating a new auth user" },
          { status: 400 }
        );
      }

      const { data: created, error: authErr } = await admin.auth.admin.createUser({
        email: authEmail,
        password: temporaryPassword,
        email_confirm: true,
      });

      if (authErr) {
        if (isEmailAlreadyRegistered(authErr.message)) {
          const existingAuthUser = await findAuthUserByEmail(admin, authEmail);
          if (existingAuthUser?.id) {
            authUserId = existingAuthUser.id;
            authAction = "reused_existing_auth_user";
            authMessage = `Existing auth user reused for ${authEmail}.`;
          } else {
            authAction = "auth_skipped_existing_email_unresolved";
            authMessage = `Auth email ${authEmail} already exists, but the auth user could not be resolved. Employee profile sync will continue without auth/mobile.`;
          }
        } else {
          return NextResponse.json({ ok: false, error: authErr.message }, { status: 400 });
        }
      } else {
        authUserId = s((created as any)?.user?.id);
        if (!authUserId) {
          return NextResponse.json({ ok: false, error: "Auth user creation returned no user id" }, { status: 500 });
        }
        authAction = "created_auth_user";
        authMessage = `Auth user created for ${authEmail}.`;
      }
    }

    existingEmployee = await findExistingEmployee(admin, {
      shopId,
      remoteEmployeeId,
      authUserId,
      employeeCode,
      email,
      sourceDeviceId,
      sourceLocalEmployeeId: localEmployeeId,
    });

    const claimedEmployee = authUserId
      ? await findEmployeeByAuthUserId(admin, shopId, authUserId)
      : null;

    if (!existingEmployee && claimedEmployee) {
      existingEmployee = claimedEmployee;
    }

    const currentAuthUserId = s((existingEmployee as any)?.auth_user_id);
    let safeAuthUserId = authUserId;
    if (authUserId && claimedEmployee && existingEmployee && s((claimedEmployee as any).id) != s((existingEmployee as any).id)) {
      needsAuthRepair = true;
      safeAuthUserId = currentAuthUserId;
      authAction = "auth_conflict";
      authMessage = `Auth user ${authUserId} is already linked to employee ${(claimedEmployee as any)?.employee_code || (claimedEmployee as any)?.id}. Profile sync completed, but auth/mobile needs manual repair.`;
    }

    let desiredAuthUserId = currentAuthUserId;
    let shouldWriteAuthUserId = false;
    if (!needsAuthRepair) {
      if (provisionMode === "create_employee_only" || provisionMode === "update_employee_only" || provisionMode === "disable_mobile_access") {
        desiredAuthUserId = currentAuthUserId;
      } else if (safeAuthUserId) {
        desiredAuthUserId = safeAuthUserId;
        if (currentAuthUserId && currentAuthUserId === safeAuthUserId) {
          authAction = "auth_already_linked";
          authMessage = `Auth user ${safeAuthUserId} is already linked to this employee.`;
        } else {
          shouldWriteAuthUserId = currentAuthUserId !== desiredAuthUserId;
        }
      }
    }

    if (desiredAuthUserId && !needsAuthRepair && shouldManageAuth) {
      await upsertShopMember(admin, {
        shopId,
        userId: desiredAuthUserId,
        role: requestedRole,
      });
    }

    const employeePatch = {
      shop_id: shopId,
      ...(existingEmployee ? {} : { auth_user_id: desiredAuthUserId || null }),
      ...(existingEmployee && shouldWriteAuthUserId ? { auth_user_id: desiredAuthUserId || null } : {}),
      employee_code: employeeCode,
      display_name: displayName,
      full_name: fullName || displayName,
      preferred_name: preferredName || displayName,
      username,
      email,
      phone,
      department,
      job_title: jobTitle,
      company_name: companyName,
      status,
      home_address_1: homeAddress1,
      home_address_2: homeAddress2,
      home_city: homeCity,
      home_state: homeState,
      home_postal_code: homePostalCode,
      social_security_number: socialSecurityNumber,
      role: toEmployeeRole(requestedRole),
      is_active: desiredActive,
      runbook_access_enabled: runBookAccessEnabled,
      mobile_access_enabled: mobileAccessEnabled,
      workstation_access_enabled: workstationAccessEnabled,
      can_dashboard: canDashboard,
      can_po_entry: canPoEntry,
      can_components: canComponents,
      can_ballooning: canBallooning,
      can_inspection: canInspection,
      can_gcoding: canGCoding,
      can_routing_db: canRoutingDb,
      can_work_orders: canWorkOrders,
      can_messaging: canMessaging,
      can_library: canLibrary,
      can_hr_department: canHrDepartment,
      can_settings: canSettings,
      can_timeclock: canTimeClock,
      can_dashboard_view: canDashboardView,
      can_jobs_module: canJobsModule,
      can_inspection_entry: canInspectionEntry,
      can_camera_view: canCameraView,
      workstation_session_timeout_minutes: workstationSessionTimeoutMinutes,
      mobile_pin_salt_base64: mobilePinSaltBase64,
      mobile_pin_hash_base64: mobilePinHashBase64,
      avatar_url_256: avatarUrl256,
      avatar_url_512: avatarUrl512,
      avatar_updated_at: avatarUrl256 || avatarUrl512 ? new Date().toISOString() : null,
      source_device_id: sourceDeviceId || s((existingEmployee as any)?.source_device_id),
      source_local_employee_id: localEmployeeId ?? ((existingEmployee as any)?.source_local_employee_id ?? null),
    };

    let remoteEmployee: any = existingEmployee;
    if ((existingEmployee as any)?.id) {
      const { data, error } = await admin
        .from("employees")
        .update(employeePatch)
        .eq("id", (existingEmployee as any).id)
        .select("id,shop_id,auth_user_id,employee_code,display_name,role,is_active,source_device_id,source_local_employee_id,created_at")
        .single();

      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }
      remoteEmployee = data;
    } else {
      const { data, error } = await admin
        .from("employees")
        .insert(employeePatch)
        .select("id,shop_id,auth_user_id,employee_code,display_name,role,is_active,source_device_id,source_local_employee_id,created_at")
        .single();

      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }
      remoteEmployee = data;
    }

    const willReleaseSeat = !desiredActive && hadLicensedAuth;
    const finalActiveCount = activeUserCount + (willConsumeNewSeat ? 1 : 0) - (willReleaseSeat ? 1 : 0);

    return NextResponse.json({
      ok: true,
      shop_id: shopId,
      local_employee_id: localEmployeeIdRaw ?? null,
      source_device_id: s((remoteEmployee as any)?.source_device_id),
      source_local_employee_id: (remoteEmployee as any)?.source_local_employee_id ?? localEmployeeId,
      remote_employee_id: s((remoteEmployee as any)?.id),
      auth_user_id: s((remoteEmployee as any)?.auth_user_id),
      auth_email: authEmail,
      employee_code: s((remoteEmployee as any)?.employee_code),
      display_name: s((remoteEmployee as any)?.display_name),
      role: s((remoteEmployee as any)?.role),
      status,
      is_active: !!(remoteEmployee as any)?.is_active,
      mobile_ready: !!(remoteEmployee as any)?.auth_user_id && !!(remoteEmployee as any)?.is_active && !needsAuthRepair,
      auth_action: authAction,
      auth_message: authMessage,
      needs_auth_repair: needsAuthRepair,
      seat_limit: effectiveSeatLimit,
      active_user_count: finalActiveCount,
      seats_remaining: Math.max(0, effectiveSeatLimit - finalActiveCount),
      used_fallback_seat_fields: shopInfo.usedFallbackSeatFields,
      entitlement,
      subscription_plan: shopInfo.subscriptionPlan,
      employee_limit: shopInfo.employeeLimit,
    });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    const status =
      /not authenticated/i.test(msg) ? 401 :
      /access denied/i.test(msg) ? 403 :
      /must be a uuid/i.test(msg) ? 400 :
      500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}




