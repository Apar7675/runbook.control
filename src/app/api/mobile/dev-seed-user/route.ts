import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function s(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeCompanyValue(value: string) {
  return s(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function ensureLocalhost(req: Request) {
  const url = new URL(req.url);
  const host = url.hostname.toLowerCase();
  if (host !== "localhost" && host !== "127.0.0.1") {
    throw new Error("This route is only available on localhost.");
  }
}

async function findAuthUserByEmail(admin: ReturnType<typeof supabaseAdmin>, email: string) {
  const normalized = s(email).toLowerCase();
  for (let page = 1; page <= 25; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);

    const users = (data as any)?.users || [];
    const match = users.find((user: any) => s(user?.email).toLowerCase() === normalized);
    if (match) return match;
    if (users.length < 200) break;
  }
  return null;
}

function overlapScore(left: string, right: string) {
  if (!left || !right) return 0;
  if (left === right) return 10_000;
  if (left.includes(right) || right.includes(left)) return 5_000 + Math.min(left.length, right.length);

  let score = 0;
  for (const ch of new Set(right.split(""))) {
    if (left.includes(ch)) score += 1;
  }
  return score;
}

async function resolveShop(admin: ReturnType<typeof supabaseAdmin>, queryRaw: string) {
  const query = normalizeCompanyValue(queryRaw);
  let data: any[] | null = null;
  let error: any = null;

  ({ data, error } = await admin
    .from("rb_shops")
    .select("id,name,code,created_at")
    .order("created_at", { ascending: false })
    .limit(200));

  if (error?.message && /column .*code/i.test(error.message)) {
    ({ data, error } = await admin
      .from("rb_shops")
      .select("id,name,created_at")
      .order("created_at", { ascending: false })
      .limit(200));
  }

  if (error) throw new Error(error.message);

  let best: any = null;
  let bestScore = 0;
  for (const row of data ?? []) {
    const score = Math.max(
      overlapScore(normalizeCompanyValue(row?.name), query),
      overlapScore(normalizeCompanyValue(row?.code), query)
    );
    if (score > bestScore) {
      best = row;
      bestScore = score;
    }
  }

  if (!best || bestScore < 4) throw new Error("Company not found");
  return best;
}

export async function POST(req: Request) {
  try {
    ensureLocalhost(req);

    const body = await req.json().catch(() => ({}));
    const company = s((body as any)?.company);
    const email = s((body as any)?.email).toLowerCase();
    const password = s((body as any)?.password);
    const displayName = s((body as any)?.display_name) || "Mobile Test User";
    const employeeCode = (s((body as any)?.employee_code) || "MOBILEDEV").toUpperCase();

    if (!company) return NextResponse.json({ ok: false, error: "company required" }, { status: 400 });
    if (!email) return NextResponse.json({ ok: false, error: "email required" }, { status: 400 });
    if (password.length < 8) return NextResponse.json({ ok: false, error: "password must be at least 8 characters" }, { status: 400 });

    const admin = supabaseAdmin();
    const shop = await resolveShop(admin, company);

    let authUser = await findAuthUserByEmail(admin, email);
    if (authUser?.id) {
      const { error } = await admin.auth.admin.updateUserById(String(authUser.id), {
        password,
        email_confirm: true,
      });
      if (error) throw new Error(error.message);
    } else {
      const created = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (created.error) throw new Error(created.error.message);
      authUser = created.data.user;
    }

    const authUserId = s((authUser as any)?.id);
    if (!authUserId) throw new Error("Auth user creation failed.");

    const { data: member, error: memberLookupError } = await admin
      .from("rb_shop_members")
      .select("id")
      .eq("shop_id", shop.id)
      .eq("user_id", authUserId)
      .maybeSingle();
    if (memberLookupError) throw new Error(memberLookupError.message);

    if (!member?.id) {
      const { error: memberInsertError } = await admin
        .from("rb_shop_members")
        .insert({
          shop_id: shop.id,
          user_id: authUserId,
          role: "member",
        });
      if (memberInsertError) throw new Error(memberInsertError.message);
    }

    const employeePayload = {
      shop_id: shop.id,
      auth_user_id: authUserId,
      employee_code: employeeCode,
      display_name: displayName,
      full_name: displayName,
      preferred_name: displayName,
      email,
      role: "employee",
      status: "Active",
      is_active: true,
      runbook_access_enabled: true,
      mobile_access_enabled: true,
      can_work_orders: true,
      can_messaging: true,
      can_timeclock: true,
    };

    const { data: existingEmployee, error: existingEmployeeError } = await admin
      .from("employees")
      .select("id")
      .eq("shop_id", shop.id)
      .eq("auth_user_id", authUserId)
      .maybeSingle();
    if (existingEmployeeError) throw new Error(existingEmployeeError.message);

    if (existingEmployee?.id) {
      const { error: employeeUpdateError } = await admin
        .from("employees")
        .update(employeePayload)
        .eq("id", existingEmployee.id);
      if (employeeUpdateError) throw new Error(employeeUpdateError.message);
    } else {
      const { error: employeeInsertError } = await admin.from("employees").insert(employeePayload);
      if (employeeInsertError) throw new Error(employeeInsertError.message);
    }

    return NextResponse.json({
      ok: true,
      company: {
        id: String(shop.id),
        name: String(shop.name ?? "Unnamed Company"),
      },
      user: {
        email,
        password,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Seed failed" }, { status: 500 });
  }
}
