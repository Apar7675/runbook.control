import { getShopSnapshot, getViewerContext, type ShopSnapshot, type ViewerContext } from "@/lib/control/summary";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type SupportBundleViewRow = {
  id: string;
  shop_id: string | null;
  shop_name: string | null;
  file_path: string | null;
  notes: string | null;
  uploaded_by: string | null;
  created_at: string | null;
  device_label: string;
  size_label: string;
  status_label: string;
  action_href: string | null;
};

export type CapabilitySupportRow = {
  device_id: string;
  device_name: string;
  shop_id: string | null;
  shop_name: string | null;
  requirements_status: string | null;
  os_label: string;
  ram_label: string;
  disk_free_label: string;
  reported_at: string | null;
};

export type DeleteOperationViewRow = {
  id: string;
  shop_id: string | null;
  shop_name: string | null;
  phase: string | null;
  status: string | null;
  started_at: string | null;
  finished_at: string | null;
  recent_log_summary: string | null;
  action_href: string | null;
};

export type SupportViewsData = {
  context: ViewerContext;
  shopSnapshots: Map<string, ShopSnapshot>;
  bundles: SupportBundleViewRow[];
  capabilityRows: CapabilitySupportRow[];
  deleteOperations: DeleteOperationViewRow[];
  schemaSummary: {
    available: boolean;
    checked_at: string;
    shops: number;
    members: number;
    employees: number;
    devices: number;
    timeEvents: number;
    supportBundles: number;
  };
  summary: {
    supportBundles: number;
    shopsWithIssues: number;
    devicesWithCapabilityWarnings: number;
    cleanupOperations: number;
    recentSupportActivity: number;
  };
};

type SupportBundleDbRow = {
  id: string | null;
  shop_id: string | null;
  file_path: string | null;
  notes: string | null;
  uploaded_by: string | null;
  created_at: string | null;
};

type CapabilityDbRow = {
  device_id: string | null;
  reported_at: string | null;
  os_name: string | null;
  os_version: string | null;
  total_ram_bytes: number | string | null;
  system_drive_free_bytes: number | string | null;
  requirements_status: string | null;
};

type DeviceDbRow = {
  id: string | null;
  shop_id: string | null;
  name: string | null;
};

type DeleteOperationDbRow = {
  id: string | null;
  shop_id: string | null;
  shop_name: string | null;
  status: string | null;
  started_at: string | null;
  completed_at: string | null;
  result_json: unknown;
  error_json: unknown;
};

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asText(value: unknown) {
  return String(value ?? "").trim();
}

function isoOrNull(value: unknown) {
  const text = asText(value);
  return text || null;
}

function asNullableNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function newestIso(...values: Array<string | null | undefined>) {
  let winner: string | null = null;
  for (const value of values) {
    const text = asText(value);
    if (!text) continue;
    if (!winner || text > winner) winner = text;
  }
  return winner;
}

function formatBytes(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value) || value < 0) return "Not surfaced";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let amount = value;
  let unitIndex = 0;
  while (amount >= 1024 && unitIndex < units.length - 1) {
    amount /= 1024;
    unitIndex += 1;
  }
  const digits = amount >= 100 || unitIndex === 0 ? 0 : amount >= 10 ? 1 : 2;
  return `${amount.toFixed(digits)} ${units[unitIndex]}`;
}

function tryExtractMissingColumn(message: string): string | null {
  const relationMatch = message.match(/column\s+"([^"]+)"\s+of\s+relation/i);
  if (relationMatch?.[1]) return relationMatch[1];

  const schemaCacheMatch = message.match(/Could not find the '([^']+)' column/i);
  if (schemaCacheMatch?.[1]) return schemaCacheMatch[1];

  const qualifiedMatch = message.match(/column\s+[a-zA-Z0-9_]+\.(\w+)\s+does\s+not\s+exist/i);
  if (qualifiedMatch?.[1]) return qualifiedMatch[1];

  return null;
}

async function countWhere(admin: ReturnType<typeof supabaseAdmin>, table: string) {
  const { count, error } = await admin.from(table).select("id", { count: "exact", head: true });
  if (error) return 0;
  return count ?? 0;
}

async function loadShopSnapshots(context: ViewerContext) {
  const snapshots = await Promise.all(context.shops.map((shop) => getShopSnapshot(shop)));
  return new Map(snapshots.map((snapshot) => [snapshot.id, snapshot]));
}

async function loadSupportBundles(shopIds: string[]) {
  if (shopIds.length === 0) return [] as SupportBundleDbRow[];
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("rb_support_bundles")
    .select("id,shop_id,file_path,notes,uploaded_by,created_at")
    .in("shop_id", shopIds)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return [] as SupportBundleDbRow[];
  return asArray<SupportBundleDbRow>(data);
}

async function loadCapabilityRows() {
  const admin = supabaseAdmin();
  const columns = [
    "device_id",
    "reported_at",
    "os_name",
    "os_version",
    "total_ram_bytes",
    "system_drive_free_bytes",
    "requirements_status",
  ];
  let working = [...columns];

  for (let attempt = 0; attempt < columns.length; attempt += 1) {
    try {
      const { data, error } = await admin
        .from("rb_device_capability_snapshots")
        .select(working.join(","))
        .order("reported_at", { ascending: false })
        .limit(500);

      if (!error) return asArray<CapabilityDbRow>(data);

      const missing = tryExtractMissingColumn(String(error.message ?? ""));
      if (missing && working.includes(missing)) {
        working = working.filter((column) => column !== missing);
        continue;
      }
      return [] as CapabilityDbRow[];
    } catch {
      return [] as CapabilityDbRow[];
    }
  }

  return [] as CapabilityDbRow[];
}

async function loadDevices(deviceIds: string[]) {
  const ids = [...new Set(deviceIds.filter(Boolean))];
  const deviceMap = new Map<string, DeviceDbRow>();
  if (ids.length === 0) return deviceMap;

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("rb_devices")
    .select("id,shop_id,name")
    .in("id", ids);

  if (error) return deviceMap;
  for (const row of asArray<DeviceDbRow>(data)) {
    const id = asText(row.id);
    if (!id) continue;
    deviceMap.set(id, row);
  }
  return deviceMap;
}

async function loadDeleteOperations() {
  const admin = supabaseAdmin();
  try {
    const { data, error } = await admin
      .from("rb_delete_operations")
      .select("id,shop_id,shop_name,status,started_at,completed_at,result_json,error_json")
      .order("started_at", { ascending: false })
      .limit(50);

    if (error) return [] as DeleteOperationDbRow[];
    return asArray<DeleteOperationDbRow>(data);
  } catch {
    return [] as DeleteOperationDbRow[];
  }
}

function pickPhase(resultJson: unknown, errorJson: unknown) {
  if (resultJson && typeof resultJson === "object") {
    const candidate = resultJson as Record<string, unknown>;
    const phase = asText(candidate.phase);
    if (phase) return phase;
  }
  if (errorJson && typeof errorJson === "object") {
    const candidate = errorJson as Record<string, unknown>;
    const phase = asText(candidate.phase);
    if (phase) return phase;
  }
  return null;
}

function pickRecentLogSummary(resultJson: unknown, errorJson: unknown) {
  if (resultJson && typeof resultJson === "object") {
    const candidate = resultJson as Record<string, unknown>;
    const logs = candidate.logs;
    if (Array.isArray(logs) && logs.length > 0) {
      const latest = logs[logs.length - 1];
      if (latest && typeof latest === "object") {
        const logRecord = latest as Record<string, unknown>;
        const step = asText(logRecord.step);
        const message = asText(logRecord.message);
        if (step && message) return `${step}: ${message}`;
        if (message) return message;
      }
    }
  }
  if (errorJson && typeof errorJson === "object") {
    const candidate = errorJson as Record<string, unknown>;
    const message = asText(candidate.message);
    if (message) return message;
  }
  return null;
}

async function loadSchemaSummary() {
  const admin = supabaseAdmin();
  const [shops, members, employees, devices, timeEvents, supportBundles] = await Promise.all([
    countWhere(admin, "rb_shops"),
    countWhere(admin, "rb_shop_members"),
    countWhere(admin, "employees"),
    countWhere(admin, "rb_devices"),
    countWhere(admin, "time_events"),
    countWhere(admin, "rb_support_bundles"),
  ]);

  return {
    available: true,
    checked_at: new Date().toISOString(),
    shops,
    members,
    employees,
    devices,
    timeEvents,
    supportBundles,
  };
}

export async function loadSupportViews(): Promise<SupportViewsData> {
  const context = await getViewerContext();
  const shopIds = context.shops.map((shop) => shop.id);
  const [shopSnapshots, bundleRows, capabilityRowsRaw, deleteOperationsRaw, schemaSummary] = await Promise.all([
    loadShopSnapshots(context),
    loadSupportBundles(shopIds),
    loadCapabilityRows(),
    loadDeleteOperations(),
    loadSchemaSummary(),
  ]);

  const deviceMap = await loadDevices(capabilityRowsRaw.map((row) => asText(row.device_id)));

  const bundles = bundleRows.map((row) => ({
    id: asText(row.id),
    shop_id: isoOrNull(row.shop_id),
    shop_name: row.shop_id ? shopSnapshots.get(asText(row.shop_id))?.name ?? context.shops.find((shop) => shop.id === row.shop_id)?.name ?? null : null,
    file_path: row.file_path ?? null,
    notes: row.notes ?? null,
    uploaded_by: row.uploaded_by ?? null,
    created_at: row.created_at ?? null,
    device_label: "Not surfaced",
    size_label: "Not surfaced",
    status_label: "Metadata recorded",
    action_href: row.shop_id ? `/shops/${row.shop_id}?tab=support` : "/support/bundle",
  } satisfies SupportBundleViewRow));

  const capabilityByDevice = new Map<string, CapabilityDbRow>();
  for (const row of capabilityRowsRaw) {
    const deviceId = asText(row.device_id);
    if (!deviceId || capabilityByDevice.has(deviceId)) continue;
    capabilityByDevice.set(deviceId, row);
  }

  const capabilityRows = [...capabilityByDevice.entries()]
    .map(([deviceId, capability]) => {
      const device = deviceMap.get(deviceId) ?? null;
      const shopId = isoOrNull(device?.shop_id);
      return {
        device_id: deviceId,
        device_name: asText(device?.name) || `Device ${deviceId.slice(0, 8)}`,
        shop_id: shopId,
        shop_name: shopId ? shopSnapshots.get(shopId)?.name ?? context.shops.find((shop) => shop.id === shopId)?.name ?? null : null,
        requirements_status: isoOrNull(capability.requirements_status),
        os_label: [asText(capability.os_name), asText(capability.os_version)].filter(Boolean).join(" ").trim() || "Not surfaced",
        ram_label: formatBytes(asNullableNumber(capability.total_ram_bytes)),
        disk_free_label: formatBytes(asNullableNumber(capability.system_drive_free_bytes)),
        reported_at: isoOrNull(capability.reported_at),
      } satisfies CapabilitySupportRow;
    })
    .sort((left, right) => String(right.reported_at ?? "").localeCompare(String(left.reported_at ?? "")));

  const deleteOperations = deleteOperationsRaw.map((row) => ({
    id: asText(row.id),
    shop_id: isoOrNull(row.shop_id),
    shop_name: isoOrNull(row.shop_name) ?? (row.shop_id ? shopSnapshots.get(asText(row.shop_id))?.name ?? null : null),
    phase: pickPhase(row.result_json, row.error_json),
    status: isoOrNull(row.status),
    started_at: isoOrNull(row.started_at),
    finished_at: isoOrNull(row.completed_at),
    recent_log_summary: pickRecentLogSummary(row.result_json, row.error_json),
    action_href: row.shop_id ? `/shops/${row.shop_id}` : null,
  } satisfies DeleteOperationViewRow));

  const capabilityWarnings = capabilityRows.filter((row) => {
    const value = asText(row.requirements_status).toLowerCase();
    return value === "warning" || value === "fail" || value === "failed";
  });

  const issueShopIds = new Set<string>();
  for (const snapshot of shopSnapshots.values()) {
    if (snapshot.access.state === "restricted" || snapshot.access.state === "expired" || snapshot.access.state === "grace" || snapshot.health.offline_devices > 0 || snapshot.health.stale_devices > 0) {
      issueShopIds.add(snapshot.id);
    }
  }
  for (const row of capabilityWarnings) {
    if (row.shop_id) issueShopIds.add(row.shop_id);
  }
  for (const row of deleteOperations) {
    const status = asText(row.status).toLowerCase();
    if (row.shop_id && (status === "running" || status === "failed" || status === "partial_failed")) issueShopIds.add(row.shop_id);
  }

  const recentSupportActivity = [
    ...bundles.map((row) => row.created_at),
    ...capabilityRows.map((row) => row.reported_at),
    ...deleteOperations.map((row) => newestIso(row.started_at, row.finished_at)),
  ].filter((value) => {
    if (!value) return false;
    const ms = Date.parse(value);
    return Number.isFinite(ms) && Date.now() - ms <= 7 * 24 * 60 * 60 * 1000;
  }).length;

  return {
    context,
    shopSnapshots,
    bundles,
    capabilityRows,
    deleteOperations,
    schemaSummary,
    summary: {
      supportBundles: bundles.length,
      shopsWithIssues: issueShopIds.size,
      devicesWithCapabilityWarnings: capabilityWarnings.length,
      cleanupOperations: deleteOperations.filter((row) => {
        const status = asText(row.status).toLowerCase();
        return status === "running" || status === "failed" || status === "partial_failed" || status === "pending";
      }).length,
      recentSupportActivity,
    },
  };
}
