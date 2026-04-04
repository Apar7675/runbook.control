import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireSessionUser } from "@/lib/desktopAuth";
import { assertUuid } from "@/lib/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeRole(value: unknown) {
  const role = String(value ?? "").trim().toLowerCase();
  return role === "primary" || role === "secondary" ? role : "";
}

function formatSbError(error: any) {
  if (!error) return "Unknown error";
  const msg = String(error.message ?? error ?? "");
  const code = error.code ? ` code=${String(error.code)}` : "";
  const details = error.details ? ` details=${String(error.details)}` : "";
  const hint = error.hint ? ` hint=${String(error.hint)}` : "";
  return `${msg}${code}${details}${hint}`;
}

function tryExtractMissingColumn(msg: string): string | null {
  const relationMatch = msg.match(/column\s+"([^"]+)"\s+of\s+relation/i);
  if (relationMatch?.[1]) return relationMatch[1];

  const schemaCacheMatch = msg.match(/could not find the\s+'([^']+)'\s+column/i);
  if (schemaCacheMatch?.[1]) return schemaCacheMatch[1];

  const qualifiedColumnMatch = msg.match(/column\s+([a-z0-9_]+\.){0,2}([a-z0-9_]+)\s+does not exist/i);
  if (qualifiedColumnMatch?.[2]) return qualifiedColumnMatch[2];

  return null;
}

function isMissingDeviceRole(msg: string) {
  const col = tryExtractMissingColumn(msg);
  return String(col ?? "").trim().toLowerCase() === "device_role";
}

async function requireMembership(admin: any, shopId: string, userId: string) {
  const { data, error } = await admin
    .from("rb_shop_members")
    .select("id")
    .eq("shop_id", shopId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error("Access denied");
}

async function loadDevice(admin: any, deviceId: string) {
  const baseColumns = ["id", "shop_id", "name", "device_type", "status"];

  try {
    const { data, error } = await admin
      .from("rb_devices")
      .select(`${baseColumns.join(",")},device_role`)
      .eq("id", deviceId)
      .maybeSingle();

    if (error) throw error;
    return {
      data,
      hasDeviceRoleColumn: true,
    };
  } catch (error: any) {
    const msg = formatSbError(error);
    if (!isMissingDeviceRole(msg)) throw new Error(msg);

    const { data, error: fallbackError } = await admin
      .from("rb_devices")
      .select(baseColumns.join(","))
      .eq("id", deviceId)
      .maybeSingle();

    if (fallbackError) throw new Error(formatSbError(fallbackError));
    return {
      data: data ? { ...data, device_role: "" } : data,
      hasDeviceRoleColumn: false,
    };
  }
}

async function loadPrimary(admin: any, shopId: string, excludeDeviceId?: string, hasDeviceRoleColumn = true) {
  if (!hasDeviceRoleColumn) return null;

  let query = admin
    .from("rb_devices")
    .select("id, name, device_role")
    .eq("shop_id", shopId)
    .eq("device_role", "primary")
    .limit(1);

  if (excludeDeviceId) query = query.neq("id", excludeDeviceId);

  try {
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data;
  } catch (error: any) {
    const msg = formatSbError(error);
    if (isMissingDeviceRole(msg)) return null;
    throw new Error(msg);
  }
}

async function updateDevice(admin: any, deviceId: string, values: Record<string, any>) {
  try {
    const { error } = await admin
      .from("rb_devices")
      .update(values)
      .eq("id", deviceId);

    if (error) throw error;
  } catch (error: any) {
    const msg = formatSbError(error);
    if (Object.prototype.hasOwnProperty.call(values, "device_role") && isMissingDeviceRole(msg)) {
      const fallbackValues = { ...values };
      delete fallbackValues.device_role;

      const { error: fallbackError } = await admin
        .from("rb_devices")
        .update(fallbackValues)
        .eq("id", deviceId);

      if (fallbackError) throw new Error(formatSbError(fallbackError));
      return false;
    }

    throw new Error(msg);
  }

  return Object.prototype.hasOwnProperty.call(values, "device_role");
}

async function insertDevice(admin: any, values: Record<string, any>) {
  try {
    const { error } = await admin
      .from("rb_devices")
      .insert(values);

    if (error) throw error;
  } catch (error: any) {
    const msg = formatSbError(error);
    if (Object.prototype.hasOwnProperty.call(values, "device_role") && isMissingDeviceRole(msg)) {
      const fallbackValues = { ...values };
      delete fallbackValues.device_role;

      const { error: fallbackError } = await admin
        .from("rb_devices")
        .insert(fallbackValues);

      if (fallbackError) throw new Error(formatSbError(fallbackError));
      return false;
    }

    throw new Error(msg);
  }

  return Object.prototype.hasOwnProperty.call(values, "device_role");
}

export async function GET(req: Request) {
  try {
    const { user } = await requireSessionUser(req);
    const url = new URL(req.url);
    const shopId = String(url.searchParams.get("shop_id") ?? "").trim();
    const deviceId = String(url.searchParams.get("device_id") ?? "").trim();

    if (!shopId) return NextResponse.json({ ok: false, error: "Missing shop_id" }, { status: 400 });
    if (!deviceId) return NextResponse.json({ ok: false, error: "Missing device_id" }, { status: 400 });
    assertUuid("shop_id", shopId);
    assertUuid("device_id", deviceId);

    const admin = supabaseAdmin();
    await requireMembership(admin, shopId, user.id);

    const loadedDevice = await loadDevice(admin, deviceId);
    const primary = await loadPrimary(admin, shopId, undefined, loadedDevice.hasDeviceRoleColumn);
    const device = loadedDevice.data;

    if (device?.id && String(device.shop_id ?? "").trim() !== shopId) {
      return NextResponse.json({ ok: false, error: "Device already belongs to another shop." }, { status: 403 });
    }

    return NextResponse.json({
      ok: true,
      shop_id: shopId,
      device_id: deviceId,
      device_role: String(device?.device_role ?? "").trim(),
      primary_exists: !!primary?.id,
      primary_device_id: String(primary?.id ?? "").trim(),
      primary_device_name: String(primary?.name ?? "").trim(),
    });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    const status = /not authenticated/i.test(msg) ? 401 : /access denied/i.test(msg) ? 403 : /must be a uuid/i.test(msg) ? 400 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const { user } = await requireSessionUser(req);
    const body = await req.json().catch(() => ({}));
    const shopId = String(body.shop_id ?? "").trim();
    const deviceId = String(body.device_id ?? "").trim();
    const deviceRole = normalizeRole(body.role);
    const deviceName = String(body.device_name ?? "").trim();

    if (!shopId) return NextResponse.json({ ok: false, error: "Missing shop_id" }, { status: 400 });
    if (!deviceId) return NextResponse.json({ ok: false, error: "Missing device_id" }, { status: 400 });
    if (!deviceRole) return NextResponse.json({ ok: false, error: "Missing role" }, { status: 400 });
    assertUuid("shop_id", shopId);
    assertUuid("device_id", deviceId);

    const admin = supabaseAdmin();
    await requireMembership(admin, shopId, user.id);

    const loadedDevice = await loadDevice(admin, deviceId);
    const existing = loadedDevice.data;
    if (existing?.id && String(existing.shop_id ?? "").trim() !== shopId) {
      return NextResponse.json({ ok: false, error: "Device already belongs to another shop." }, { status: 403 });
    }

    const hasDeviceRoleColumn = loadedDevice.hasDeviceRoleColumn;
    const otherPrimary = await loadPrimary(admin, shopId, deviceId, hasDeviceRoleColumn);
    if (deviceRole === "primary" && otherPrimary?.id) {
      return NextResponse.json({
        ok: false,
        error: "A main shop computer is already set for this shop.",
        primary_device_id: String(otherPrimary.id ?? "").trim(),
        primary_device_name: String(otherPrimary.name ?? "").trim(),
      }, { status: 409 });
    }

    const name = deviceName || `Desktop ${deviceId.slice(0, 8)}`;
    const devicePayload = {
      name,
      device_type: "desktop",
      status: "active",
      device_role: deviceRole,
    };

    const roleColumnActive = existing?.id
      ? await updateDevice(admin, deviceId, devicePayload)
      : await insertDevice(admin, {
          id: deviceId,
          shop_id: shopId,
          ...devicePayload,
        });

    const primary = await loadPrimary(admin, shopId, undefined, roleColumnActive);
    return NextResponse.json({
      ok: true,
      shop_id: shopId,
      device_id: deviceId,
      device_role: roleColumnActive ? deviceRole : "",
      primary_exists: !!primary?.id,
      primary_device_id: String(primary?.id ?? "").trim(),
      primary_device_name: String(primary?.name ?? "").trim(),
    });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    const status = /not authenticated/i.test(msg) ? 401 : /access denied/i.test(msg) ? 403 : /must be a uuid/i.test(msg) ? 400 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
