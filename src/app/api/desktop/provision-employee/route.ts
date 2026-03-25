import { NextResponse } from "next/server";
import { requireUserFromBearer } from "@/lib/desktopAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { assertUuid } from "@/lib/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProvisionMode =
  | "create_auth_user"
  | "link_existing_auth_user"
  | "update_employee_only"
  | "disable_mobile_access";

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

function toSharedRole(input: string) {
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

function toShopMemberRole(sharedRole: string) {
  return sharedRole === "owner" || sharedRole === "admin" || sharedRole === "manager" || sharedRole === "foreman"
    ? "foreman"
    : "worker";
}

function toActiveStatus(input: string, explicitEnabled: boolean) {
  const status = s(input).toLowerCase();
  if (!explicitEnabled) return false;
  return status === "" || status === "active";
}

function defaultIncludedSeats() {
  const raw = s(process.env.RUNBOOK_DEFAULT_INCLUDED_USER_SEATS);
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 20;
  return Math.trunc(n);
}

function makeAuthEmail(params: { shopId: string; email: string; username: string; employeeCode: string }) {
  const email = s(params.email).toLowerCase();
  if (email) return email;

  const base = s(params.username) || s(params.employeeCode) || "employee";
  const safe = base.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "employee";
  return `${safe}+${params.shopId}@runbook.local`;
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

async function getBillingAndSeatInfo(admin: any, shopId: string) {
  const baseIncludedSeats = defaultIncludedSeats();

  const { data: rich, error: richErr } = await admin
    .from("rb_shops")
    .select("id,billing_status,billing_current_period_end,included_user_seats,purchased_extra_user_seats")
    .eq("id", shopId)
    .maybeSingle();

  if (!richErr && rich?.id) {
    const included = Number((rich as any).included_user_seats ?? baseIncludedSeats);
    const extra = Number((rich as any).purchased_extra_user_seats ?? 0);
    return {
      billingStatus: s((rich as any).billing_status).toLowerCase() || "none",
      includedUserSeats: Number.isFinite(included) ? Math.trunc(included) : baseIncludedSeats,
      purchasedExtraUserSeats: Number.isFinite(extra) ? Math.trunc(extra) : 0,
      usedFallbackSeatFields: false,
    };
  }

  const { data: basic, error: basicErr } = await admin
    .from("rb_shops")
    .select("id,billing_status,billing_current_period_end")
    .eq("id", shopId)
    .maybeSingle();

  if (basicErr) throw new Error(basicErr.message);
  if (!(basic as any)?.id) throw new Error("Shop not found");

  return {
    billingStatus: s((basic as any).billing_status).toLowerCase() || "none",
    includedUserSeats: baseIncludedSeats,
    purchasedExtraUserSeats: 0,
    usedFallbackSeatFields: true,
  };
}

async function countActiveLicensedUsers(admin: any, shopId: string) {
  const { count, error } = await admin
    .from("employees")
    .select("id", { count: "exact", head: true })
    .eq("shop_id", shopId)
    .eq("is_active", true);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function findExistingEmployee(admin: any, args: {
  shopId: string;
  remoteEmployeeId: string;
  authUserId: string;
  employeeCode: string;
}) {
  if (args.remoteEmployeeId) {
    const { data, error } = await admin
      .from("employees")
      .select("id,shop_id,auth_user_id,employee_code,display_name,role,is_active")
      .eq("shop_id", args.shopId)
      .eq("id", args.remoteEmployeeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return data;
  }

  if (args.authUserId) {
    const { data, error } = await admin
      .from("employees")
      .select("id,shop_id,auth_user_id,employee_code,display_name,role,is_active")
      .eq("shop_id", args.shopId)
      .eq("auth_user_id", args.authUserId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return data;
  }

  if (args.employeeCode) {
    const { data, error } = await admin
      .from("employees")
      .select("id,shop_id,auth_user_id,employee_code,display_name,role,is_active")
      .eq("shop_id", args.shopId)
      .eq("employee_code", args.employeeCode)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return data;
  }

  return null;
}

async function upsertShopMember(admin: any, args: {
  shopId: string;
  userId: string;
  displayName: string;
  role: string;
  isActive: boolean;
}) {
  const desiredRole = toShopMemberRole(args.role);
  const desiredStatus = args.isActive ? "approved" : "suspended";

  const { data: existing, error: lookupErr } = await admin
    .from("shop_members")
    .select("id")
    .eq("shop_id", args.shopId)
    .eq("user_id", args.userId)
    .maybeSingle();

  if (lookupErr) throw new Error(lookupErr.message);

  if ((existing as any)?.id) {
    const { error: updateErr } = await admin
      .from("shop_members")
      .update({
        role: desiredRole,
        status: desiredStatus,
        display_name: args.displayName,
      })
      .eq("id", (existing as any).id);

    if (updateErr) throw new Error(updateErr.message);
    return;
  }

  const { error: insertErr } = await admin
    .from("shop_members")
    .insert({
      shop_id: args.shopId,
      user_id: args.userId,
      role: desiredRole,
      status: desiredStatus,
      display_name: args.displayName,
    });

  if (insertErr) throw new Error(insertErr.message);
}

export async function POST(req: Request) {
  try {
    const { user } = await requireUserFromBearer(req);
    const body = await req.json().catch(() => ({}));

    const shopId = s((body as any).shop_id);
    const localEmployeeIdRaw = (body as any).local_employee_id;
    const remoteEmployeeId = s((body as any).remote_employee_id);
    let authUserId = s((body as any).auth_user_id);
    const employeeCode = s((body as any).employee_code);
    const displayName = s((body as any).display_name);
    const email = s((body as any).email).toLowerCase();
    const username = s((body as any).username);
    const role = toSharedRole((body as any).role);
    const status = s((body as any).status) || "Active";
    const runBookAccessEnabled = b((body as any).runbook_access_enabled, true);
    const mobileAccessEnabled = b((body as any).mobile_access_enabled, true);
    const temporaryPassword = s((body as any).temporary_password);
    const requestedMode = s((body as any).provision_mode) as ProvisionMode;
    const provisionMode: ProvisionMode =
      requestedMode === "link_existing_auth_user" ||
      requestedMode === "update_employee_only" ||
      requestedMode === "disable_mobile_access"
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

    const shopInfo = await getBillingAndSeatInfo(admin, shopId);
    const billingAllowed = shopInfo.billingStatus === "active" || shopInfo.billingStatus === "trialing";
    if (!billingAllowed) {
      return NextResponse.json({ ok: false, error: "Billing not active", billing_status: shopInfo.billingStatus }, { status: 402 });
    }

    const sharedAccessEnabled = provisionMode !== "disable_mobile_access" && (runBookAccessEnabled || mobileAccessEnabled);
    const desiredActive = provisionMode === "disable_mobile_access" ? false : toActiveStatus(status, sharedAccessEnabled);

    const existingEmployee = await findExistingEmployee(admin, {
      shopId,
      remoteEmployeeId,
      authUserId,
      employeeCode,
    });

    const effectiveSeatLimit = Math.max(0, shopInfo.includedUserSeats + shopInfo.purchasedExtraUserSeats);
    const activeUserCount = await countActiveLicensedUsers(admin, shopId);
    const willConsumeNewSeat = desiredActive && (!(existingEmployee as any) || !(existingEmployee as any).is_active);

    if (willConsumeNewSeat && activeUserCount >= effectiveSeatLimit) {
      return NextResponse.json(
        {
          ok: false,
          error: "No available user seats. Buy more seats or deactivate another user first.",
          seat_limit: effectiveSeatLimit,
          active_user_count: activeUserCount,
          seats_remaining: Math.max(0, effectiveSeatLimit - activeUserCount),
          used_fallback_seat_fields: shopInfo.usedFallbackSeatFields,
        },
        { status: 409 }
      );
    }

    const authEmail = makeAuthEmail({ shopId, email, username, employeeCode });

    if (!authUserId && provisionMode !== "update_employee_only" && provisionMode !== "disable_mobile_access") {
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
        return NextResponse.json({ ok: false, error: authErr.message }, { status: 400 });
      }

      authUserId = s((created as any)?.user?.id);
      if (!authUserId) {
        return NextResponse.json({ ok: false, error: "Auth user creation returned no user id" }, { status: 500 });
      }
    }

    if (authUserId && provisionMode !== "update_employee_only") {
      await upsertShopMember(admin, {
        shopId,
        userId: authUserId,
        displayName,
        role,
        isActive: desiredActive,
      });
    }

    const employeePatch = {
      shop_id: shopId,
      auth_user_id: authUserId || null,
      employee_code: employeeCode,
      display_name: displayName,
      role,
      is_active: desiredActive,
    };

    let remoteEmployee: any = existingEmployee;
    if ((existingEmployee as any)?.id) {
      const { data, error } = await admin
        .from("employees")
        .update(employeePatch)
        .eq("id", (existingEmployee as any).id)
        .select("id,shop_id,auth_user_id,employee_code,display_name,role,is_active,created_at")
        .single();

      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }
      remoteEmployee = data;
    } else {
      const { data, error } = await admin
        .from("employees")
        .insert(employeePatch)
        .select("id,shop_id,auth_user_id,employee_code,display_name,role,is_active,created_at")
        .single();

      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }
      remoteEmployee = data;
    }

    const finalActiveCount = activeUserCount + (willConsumeNewSeat ? 1 : 0) - (!desiredActive && (existingEmployee as any)?.is_active ? 1 : 0);

    return NextResponse.json({
      ok: true,
      shop_id: shopId,
      local_employee_id: localEmployeeIdRaw ?? null,
      remote_employee_id: s((remoteEmployee as any)?.id),
      auth_user_id: s((remoteEmployee as any)?.auth_user_id),
      auth_email: authEmail,
      employee_code: s((remoteEmployee as any)?.employee_code),
      display_name: s((remoteEmployee as any)?.display_name),
      role: s((remoteEmployee as any)?.role),
      status,
      is_active: !!(remoteEmployee as any)?.is_active,
      mobile_ready: !!(remoteEmployee as any)?.auth_user_id && !!(remoteEmployee as any)?.is_active,
      seat_limit: effectiveSeatLimit,
      active_user_count: finalActiveCount,
      seats_remaining: Math.max(0, effectiveSeatLimit - finalActiveCount),
      used_fallback_seat_fields: shopInfo.usedFallbackSeatFields,
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
