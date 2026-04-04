import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { describeShopAccess, type ShopAccessDecision } from "@/lib/billing/access";
import { getShopEntitlement } from "@/lib/billing/entitlement";
import { isPlatformAdminEmail } from "@/lib/platformAdmin";

export type ViewerShop = {
  id: string;
  name: string;
  created_at: string | null;
  member_role: string;
};

export type ViewerContext = {
  userId: string;
  email: string | null;
  isPlatformAdmin: boolean;
  shops: ViewerShop[];
};

export type ShopSnapshot = {
  id: string;
  name: string;
  member_role: string;
  access: ShopAccessDecision;
  billing_status: string | null;
  trial_ends_at: string | null;
  billing_current_period_end: string | null;
  grace_ends_at: string | null;
  counts: {
    employees_total: number;
    employees_active: number;
    employees_mobile_ready: number;
    employees_workstation_ready: number;
    devices_total: number;
    devices_active: number;
    desktops_total: number;
    desktops_active: number;
    workstations_total: number;
    workstations_active: number;
  };
  health: {
    stale_devices: number;
    offline_devices: number;
    last_device_activity_at: string | null;
    recent_audit_events: number;
  };
};

function asText(value: unknown) {
  return String(value ?? "").trim();
}

function isoOrNull(value: unknown) {
  const text = asText(value);
  return text || null;
}

function tryExtractMissingColumn(message: string): string | null {
  const text = String(message ?? "");
  const relationMatch = text.match(/column\s+"([^"]+)"\s+of\s+relation/i);
  if (relationMatch?.[1]) return relationMatch[1];

  const schemaCacheMatch = text.match(/Could not find the '([^']+)' column/i);
  if (schemaCacheMatch?.[1]) return schemaCacheMatch[1];

  const qualifiedMatch = text.match(/column\s+[a-zA-Z0-9_]+\.(\w+)\s+does\s+not\s+exist/i);
  if (qualifiedMatch?.[1]) return qualifiedMatch[1];

  return null;
}

async function loadViewerRows(userId: string, isPlatformAdmin: boolean) {
  const admin = supabaseAdmin();

  if (isPlatformAdmin) {
    const { data, error } = await admin.from("rb_shops").select("id,name,created_at").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    return (data ?? []).map((row: any) => ({
      id: asText(row.id),
      name: asText(row.name) || "Unnamed shop",
      created_at: isoOrNull(row.created_at),
      member_role: "platform_admin",
    }));
  }

  const { data, error } = await admin
    .from("rb_shop_members")
    .select("shop_id,role,rb_shops:rb_shops(id,name,created_at)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? [])
    .map((row: any) => ({
      id: asText(row?.rb_shops?.id ?? row?.shop_id),
      name: asText(row?.rb_shops?.name) || "Unnamed shop",
      created_at: isoOrNull(row?.rb_shops?.created_at),
      member_role: asText(row?.role) || "member",
    }))
    .filter((row) => row.id);
}

export async function getViewerContext(): Promise<ViewerContext> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error) throw new Error(error.message);
  if (!data.user?.id) throw new Error("Not authenticated");

  const admin = supabaseAdmin();
  const { data: adminRow, error: adminError } = await admin
    .from("rb_control_admins")
    .select("user_id")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (adminError) throw new Error(adminError.message);

  const isPlatformAdmin = !!adminRow?.user_id || isPlatformAdminEmail(data.user.email ?? null);
  const shops = await loadViewerRows(data.user.id, isPlatformAdmin);

  return {
    userId: data.user.id,
    email: data.user.email ?? null,
    isPlatformAdmin,
    shops,
  };
}

export function selectPrimaryShop(shops: ViewerShop[], preferredShopId?: string | null) {
  const preferred = asText(preferredShopId);
  if (preferred) {
    const match = shops.find((shop) => shop.id === preferred);
    if (match) return match;
  }

  return shops[0] ?? null;
}

async function loadShopBilling(admin: ReturnType<typeof supabaseAdmin>, shopId: string) {
  const columns = [
    "id",
    "name",
    "billing_status",
    "trial_ends_at",
    "billing_current_period_end",
    "grace_ends_at",
  ];

  let working = [...columns];
  for (let attempt = 0; attempt < columns.length; attempt++) {
    const { data, error } = await admin.from("rb_shops").select(working.join(",")).eq("id", shopId).maybeSingle();
    if (!error) return data as any;

    const col = tryExtractMissingColumn(String(error.message ?? error ?? ""));
    if (col && working.includes(col)) {
      working = working.filter((entry) => entry !== col);
      continue;
    }

    throw new Error(error.message);
  }

  throw new Error("Unable to load shop billing details.");
}

async function countWhere(
  admin: ReturnType<typeof supabaseAdmin>,
  table: string,
  filters: Array<{ column: string; value: unknown; op?: "eq" }>
) {
  let query = admin.from(table).select("id", { count: "exact", head: true });
  for (const filter of filters) {
    query = query.eq(filter.column, filter.value as any);
  }
  const { count, error } = await query;
  if (error) return 0;
  return count ?? 0;
}

function classifyDeviceAge(lastSeenAt: string | null) {
  if (!lastSeenAt) return "offline";
  const ms = Date.parse(lastSeenAt);
  if (!Number.isFinite(ms)) return "offline";
  const age = Date.now() - ms;
  const day = 24 * 60 * 60 * 1000;
  if (age > 7 * day) return "offline";
  if (age > day) return "stale";
  return "healthy";
}

export async function getShopSnapshot(shop: ViewerShop): Promise<ShopSnapshot> {
  const admin = supabaseAdmin();
  const access = describeShopAccess(await getShopEntitlement(shop.id));
  const billing = (await loadShopBilling(admin, shop.id)) ?? {};

  const { data: devices, error: deviceError } = await admin
    .from("rb_devices")
    .select("id,status,device_type,last_seen_at")
    .eq("shop_id", shop.id)
    .order("created_at", { ascending: false });
  if (deviceError) throw new Error(deviceError.message);

  const { data: deviceTokens } = await admin
    .from("rb_device_tokens")
    .select("device_id,last_seen_at,revoked_at")
    .in("device_id", (devices ?? []).map((device: any) => device.id));

  const tokenLastSeen = new Map<string, string>();
  for (const token of deviceTokens ?? []) {
    if (token.revoked_at) continue;
    const ts = asText(token.last_seen_at);
    const prev = tokenLastSeen.get(asText(token.device_id));
    if (ts && (!prev || ts > prev)) tokenLastSeen.set(asText(token.device_id), ts);
  }

  let staleDevices = 0;
  let offlineDevices = 0;
  let lastDeviceActivityAt: string | null = null;

  for (const device of devices ?? []) {
    const directSeen = isoOrNull((device as any).last_seen_at);
    const tokenSeen = tokenLastSeen.get(asText((device as any).id)) ?? null;
    const mergedSeen = tokenSeen && directSeen ? (tokenSeen > directSeen ? tokenSeen : directSeen) : tokenSeen ?? directSeen;

    if (mergedSeen && (!lastDeviceActivityAt || mergedSeen > lastDeviceActivityAt)) {
      lastDeviceActivityAt = mergedSeen;
    }

    const classification = classifyDeviceAge(mergedSeen);
    if (classification === "stale") staleDevices += 1;
    if (classification === "offline") offlineDevices += 1;
  }

  const [
    employeesTotal,
    employeesActive,
    employeesMobileReady,
    employeesWorkstationReady,
    recentAuditEvents,
  ] = await Promise.all([
    countWhere(admin, "employees", [{ column: "shop_id", value: shop.id }]),
    countWhere(admin, "employees", [{ column: "shop_id", value: shop.id }, { column: "is_active", value: true }]),
    countWhere(admin, "employees", [
      { column: "shop_id", value: shop.id },
      { column: "is_active", value: true },
      { column: "mobile_access_enabled", value: true },
    ]),
    countWhere(admin, "employees", [
      { column: "shop_id", value: shop.id },
      { column: "is_active", value: true },
      { column: "workstation_access_enabled", value: true },
    ]),
    countWhere(admin, "rb_audit_log", [{ column: "shop_id", value: shop.id }]),
  ]);

  const deviceRows = (devices ?? []) as any[];
  const desktops = deviceRows.filter((device) => asText(device.device_type).toLowerCase() === "desktop");
  const workstations = deviceRows.filter((device) => asText(device.device_type).toLowerCase() === "workstation");

  return {
    id: shop.id,
    name: asText((billing as any).name) || shop.name,
    member_role: shop.member_role,
    access,
    billing_status: (isoOrNull((billing as any).billing_status) ?? asText((billing as any).billing_status)) || null,
    trial_ends_at: isoOrNull((billing as any).trial_ends_at),
    billing_current_period_end: isoOrNull((billing as any).billing_current_period_end),
    grace_ends_at: isoOrNull((billing as any).grace_ends_at),
    counts: {
      employees_total: employeesTotal,
      employees_active: employeesActive,
      employees_mobile_ready: employeesMobileReady,
      employees_workstation_ready: employeesWorkstationReady,
      devices_total: deviceRows.length,
      devices_active: deviceRows.filter((device) => asText(device.status).toLowerCase() === "active").length,
      desktops_total: desktops.length,
      desktops_active: desktops.filter((device) => asText(device.status).toLowerCase() === "active").length,
      workstations_total: workstations.length,
      workstations_active: workstations.filter((device) => asText(device.status).toLowerCase() === "active").length,
    },
    health: {
      stale_devices: staleDevices,
      offline_devices: offlineDevices,
      last_device_activity_at: lastDeviceActivityAt,
      recent_audit_events: recentAuditEvents,
    },
  };
}

export async function getPlatformSnapshot(context: ViewerContext) {
  const admin = supabaseAdmin();
  const [shopCount, deviceCount, employeeCount, auditCount] = await Promise.all([
    countWhere(admin, "rb_shops", []),
    countWhere(admin, "rb_devices", []),
    countWhere(admin, "employees", []),
    countWhere(admin, "rb_audit_log", []),
  ]);

  return {
    shopCount,
    deviceCount,
    employeeCount,
    auditCount,
    manageableShopCount: context.shops.length,
  };
}
