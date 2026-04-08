import { supabaseAdmin } from "@/lib/supabase/admin";

export type DesktopShopDeviceLink = {
  shop_id: string;
  device_id: string;
  device_name: string;
  status: string;
  device_role: string;
  linked_at?: string;
  updated_at?: string;
};

const DESKTOP_LINK_TABLE = "rb_desktop_shop_links";

function formatSbError(error: any) {
  if (!error) return "Unknown error";
  const msg = String(error.message ?? error ?? "");
  const code = error.code ? ` code=${String(error.code)}` : "";
  const details = error.details ? ` details=${String(error.details)}` : "";
  const hint = error.hint ? ` hint=${String(error.hint)}` : "";
  return `${msg}${code}${details}${hint}`;
}

function tryExtractMissingRelation(msg: string) {
  const text = String(msg ?? "");
  const relationMatch = text.match(/relation\s+"([^"]+)"/i);
  if (relationMatch?.[1]) return relationMatch[1];

  const cacheMatch = text.match(/Could not find the table '([^']+)'/i);
  if (cacheMatch?.[1]) return cacheMatch[1];

  return "";
}

function isMissingDesktopLinkTable(msg: string) {
  return tryExtractMissingRelation(msg).trim().toLowerCase() === DESKTOP_LINK_TABLE;
}

function normalizeRole(value: unknown) {
  const role = String(value ?? "").trim().toLowerCase();
  return role === "primary" || role === "secondary" ? role : "";
}

function normalizeStatus(value: unknown) {
  return String(value ?? "").trim().toLowerCase() === "inactive" ? "inactive" : "active";
}

function toLink(row: any): DesktopShopDeviceLink {
  return {
    shop_id: String(row?.shop_id ?? "").trim(),
    device_id: String(row?.device_id ?? row?.id ?? "").trim(),
    device_name: String(row?.device_name ?? row?.name ?? "").trim(),
    status: normalizeStatus(row?.status),
    device_role: normalizeRole(row?.device_role),
    linked_at: String(row?.linked_at ?? row?.created_at ?? "").trim(),
    updated_at: String(row?.updated_at ?? "").trim(),
  };
}

async function loadLegacyDesktopDevice(admin: ReturnType<typeof supabaseAdmin>, deviceId: string) {
  const { data, error } = await admin
    .from("rb_devices")
    .select("id, shop_id, name, status, device_role, device_type, created_at")
    .eq("id", deviceId)
    .maybeSingle();

  if (error) throw new Error(formatSbError(error));
  if (!data?.id) return null;
  if (String(data.device_type ?? "desktop").trim().toLowerCase() !== "desktop")
    return null;

  return toLink(data);
}

async function loadLegacyPrimaryDesktopDevice(
  admin: ReturnType<typeof supabaseAdmin>,
  shopId: string,
  excludeDeviceId?: string
) {
  let query = admin
    .from("rb_devices")
    .select("id, shop_id, name, status, device_role, device_type, created_at")
    .eq("shop_id", shopId)
    .eq("device_type", "desktop")
    .eq("device_role", "primary")
    .limit(1);

  if (excludeDeviceId)
    query = query.neq("id", excludeDeviceId);

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(formatSbError(error));
  return data?.id ? toLink(data) : null;
}

export async function listDesktopShopLinksForDevice(admin: ReturnType<typeof supabaseAdmin>, deviceId: string) {
  try {
    const { data, error } = await admin
      .from(DESKTOP_LINK_TABLE)
      .select("shop_id, device_id, device_name, status, device_role, linked_at, updated_at")
      .eq("device_id", deviceId);

    if (error) throw error;
    return (data ?? []).map(toLink);
  } catch (error: any) {
    const msg = formatSbError(error);
    if (!isMissingDesktopLinkTable(msg))
      throw new Error(msg);

    const legacy = await loadLegacyDesktopDevice(admin, deviceId);
    return legacy ? [legacy] : [];
  }
}

export async function loadDesktopShopLink(admin: ReturnType<typeof supabaseAdmin>, shopId: string, deviceId: string) {
  try {
    const { data, error } = await admin
      .from(DESKTOP_LINK_TABLE)
      .select("shop_id, device_id, device_name, status, device_role, linked_at, updated_at")
      .eq("shop_id", shopId)
      .eq("device_id", deviceId)
      .maybeSingle();

    if (error) throw error;
    return data ? toLink(data) : null;
  } catch (error: any) {
    const msg = formatSbError(error);
    if (!isMissingDesktopLinkTable(msg))
      throw new Error(msg);

    const legacy = await loadLegacyDesktopDevice(admin, deviceId);
    if (!legacy || !legacy.device_id)
      return null;

    return String(legacy.shop_id ?? "").trim() === shopId ? legacy : null;
  }
}

export async function loadPrimaryDesktopShopLink(
  admin: ReturnType<typeof supabaseAdmin>,
  shopId: string,
  excludeDeviceId?: string
) {
  try {
    let query = admin
      .from(DESKTOP_LINK_TABLE)
      .select("shop_id, device_id, device_name, status, device_role, linked_at, updated_at")
      .eq("shop_id", shopId)
      .eq("device_role", "primary")
      .limit(1);

    if (excludeDeviceId)
      query = query.neq("device_id", excludeDeviceId);

    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data ? toLink(data) : null;
  } catch (error: any) {
    const msg = formatSbError(error);
    if (!isMissingDesktopLinkTable(msg))
      throw new Error(msg);

    return await loadLegacyPrimaryDesktopDevice(admin, shopId, excludeDeviceId);
  }
}

export async function upsertDesktopShopLink(
  admin: ReturnType<typeof supabaseAdmin>,
  args: {
    shopId: string;
    deviceId: string;
    deviceName: string;
    status?: string;
    deviceRole?: string;
  }
) {
  const payload = {
    shop_id: args.shopId,
    device_id: args.deviceId,
    device_name: String(args.deviceName ?? "").trim(),
    status: normalizeStatus(args.status),
    device_role: normalizeRole(args.deviceRole) || null,
    updated_at: new Date().toISOString(),
  };

  try {
    const { error } = await admin
      .from(DESKTOP_LINK_TABLE)
      .upsert(payload, { onConflict: "shop_id,device_id" });

    if (error) throw error;
    return await loadDesktopShopLink(admin, args.shopId, args.deviceId);
  } catch (error: any) {
    const msg = formatSbError(error);
    if (!isMissingDesktopLinkTable(msg))
      throw new Error(msg);

    const legacy = await loadLegacyDesktopDevice(admin, args.deviceId);
    if (legacy?.device_id && legacy.shop_id !== args.shopId) {
      throw new Error("Device already belongs to another shop.");
    }

    const values = {
      name: payload.device_name,
      device_type: "desktop",
      status: payload.status,
      device_role: payload.device_role,
    };

    if (legacy?.device_id) {
      const { error: updateError } = await admin
        .from("rb_devices")
        .update(values)
        .eq("id", args.deviceId);
      if (updateError) throw new Error(formatSbError(updateError));
    } else {
      const { error: insertError } = await admin
        .from("rb_devices")
        .insert({
          id: args.deviceId,
          shop_id: args.shopId,
          ...values,
        });
      if (insertError) throw new Error(formatSbError(insertError));
    }

    return await loadDesktopShopLink(admin, args.shopId, args.deviceId);
  }
}

export async function requireActiveDesktopShopLink(
  admin: ReturnType<typeof supabaseAdmin>,
  shopId: string,
  deviceId: string
) {
  const link = await loadDesktopShopLink(admin, shopId, deviceId);
  if (!link?.device_id)
    return { ok: false as const, error: "Desktop is not linked to this shop." };
  if (normalizeStatus(link.status) !== "active")
    return { ok: false as const, error: "Desktop link is inactive." };
  return { ok: true as const, link };
}
