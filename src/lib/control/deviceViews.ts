import { getShopSnapshot, getViewerContext, type ShopSnapshot, type ViewerContext } from "@/lib/control/summary";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type DeviceBaseRow = {
  id: string;
  shop_id: string | null;
  shop_name: string | null;
  name: string;
  status: string | null;
  created_at: string | null;
  last_seen_at: string | null;
  reported_version: string | null;
  device_type: string | null;
};

export type DeviceTokenRow = {
  id: string;
  device_id: string;
  created_at: string | null;
  issued_at: string | null;
  revoked_at: string | null;
  last_seen_at: string | null;
  label: string | null;
};

export type DeviceCapabilityRow = {
  device_id: string;
  reported_at: string | null;
  os_name: string | null;
  os_version: string | null;
  cpu_model: string | null;
  logical_cores: number | null;
  total_ram_bytes: number | null;
  system_drive_total_bytes: number | null;
  system_drive_free_bytes: number | null;
  gpu_name: string | null;
  requirements_status: string | null;
  requirements_failures: unknown;
  raw_payload: unknown;
};

export type DeviceUpdatePolicyRow = {
  shop_id: string;
  channel: string | null;
  min_version: string | null;
  pinned_version: string | null;
};

export type DeviceViewRow = DeviceBaseRow & {
  merged_last_seen_at: string | null;
  access_mode: string;
  access_reason: string;
  shop_snapshot: ShopSnapshot | null;
  active_token_count: number;
  latest_token_issued_at: string | null;
  latest_token_seen_at: string | null;
  update_policy: DeviceUpdatePolicyRow | null;
  update_status: "current" | "warning" | "required" | "not_surfaced";
  update_label: string;
  update_detail: string;
  capability: DeviceCapabilityRow | null;
  capability_warning: string | null;
};

type DeviceWithShopJoin = {
  id: string | null;
  shop_id: string | null;
  name: string | null;
  status: string | null;
  created_at: string | null;
  last_seen_at?: string | null;
  reported_version?: string | null;
  device_type: string | null;
  rb_shops?: { name?: string | null } | Array<{ name?: string | null }> | null;
};

type DeviceTokenDbRow = {
  id: string | null;
  device_id: string | null;
  created_at: string | null;
  issued_at: string | null;
  revoked_at: string | null;
  last_seen_at: string | null;
  label: string | null;
};

type CapabilityDbRow = {
  device_id: string | null;
  reported_at: string | null;
  os_name: string | null;
  os_version: string | null;
  cpu_model: string | null;
  logical_cores: number | null;
  total_ram_bytes: number | null;
  system_drive_total_bytes: number | null;
  system_drive_free_bytes: number | null;
  gpu_name: string | null;
  requirements_status: string | null;
  requirements_failures: unknown;
  raw_payload: unknown;
};

type PolicyDbRow = {
  shop_id: string | null;
  channel: string | null;
  min_version: string | null;
  pinned_version: string | null;
};

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

function tryExtractMissingColumn(message: string): string | null {
  const relationMatch = message.match(/column\s+"([^"]+)"\s+of\s+relation/i);
  if (relationMatch?.[1]) return relationMatch[1];

  const schemaCacheMatch = message.match(/Could not find the '([^']+)' column/i);
  if (schemaCacheMatch?.[1]) return schemaCacheMatch[1];

  const qualifiedMatch = message.match(/column\s+[a-zA-Z0-9_]+\.(\w+)\s+does\s+not\s+exist/i);
  if (qualifiedMatch?.[1]) return qualifiedMatch[1];

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

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function normVer(value: string) {
  return String(value || "").trim().replace(/^v/i, "");
}

function parseVer(value: string): { ok: true; parts: [number, number, number] } | { ok: false } {
  const source = normVer(value);
  if (!source) return { ok: false };
  const main = source.split(/[+-]/)[0];
  const bits = main.split(".").map((part) => part.trim()).filter(Boolean);
  if (bits.length === 0) return { ok: false };

  const nums = bits.slice(0, 3).map((part) => (/^\d+$/.test(part) ? Number(part) : Number.NaN));
  while (nums.length < 3) nums.push(0);
  if (nums.some((item) => !Number.isFinite(item) || item < 0)) return { ok: false };

  return { ok: true, parts: [nums[0], nums[1], nums[2]] };
}

function cmpVer(left: string, right: string): number | null {
  const a = parseVer(left);
  const b = parseVer(right);
  if (!a.ok || !b.ok) return null;
  for (let index = 0; index < 3; index += 1) {
    if (a.parts[index] < b.parts[index]) return -1;
    if (a.parts[index] > b.parts[index]) return 1;
  }
  return 0;
}

function humanizeStatus(value: string | null | undefined, fallback: string) {
  const text = asText(value);
  return text ? text.replaceAll("_", " ") : fallback;
}

export function formatBytes(value: number | null | undefined) {
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

function extractRequirementMessages(capability: DeviceCapabilityRow | null) {
  if (!capability) return [] as string[];

  const messages: string[] = [];
  const source = capability.requirements_failures;

  if (Array.isArray(source)) {
    for (const item of source) {
      if (typeof item === "string" && item.trim()) {
        messages.push(item.trim());
        continue;
      }
      if (item && typeof item === "object") {
        const candidate = item as Record<string, unknown>;
        const message = asText(candidate.message ?? candidate.reason ?? candidate.code);
        if (message) messages.push(message);
      }
    }
  } else if (source && typeof source === "object") {
    const candidate = source as Record<string, unknown>;
    const list = candidate.messages;
    if (Array.isArray(list)) {
      for (const item of list) {
        const text = asText(item);
        if (text) messages.push(text);
      }
    } else {
      const message = asText(candidate.message ?? candidate.reason ?? candidate.code);
      if (message) messages.push(message);
    }
  } else {
    const single = asText(source);
    if (single) messages.push(single);
  }

  if (messages.length === 0) {
    const requirementStatus = asText(capability.requirements_status).toLowerCase();
    if (requirementStatus === "warning") messages.push("Requirement warning reported.");
    if (requirementStatus === "fail" || requirementStatus === "failed") messages.push("Requirement check failed.");
  }

  return messages;
}

function computeCapabilityWarning(capability: DeviceCapabilityRow | null) {
  if (!capability) return null;
  const messages = extractRequirementMessages(capability);
  if (messages.length === 0) return null;
  return messages.slice(0, 2).join(" | ");
}

function computeAccessMode(deviceType: string | null, snapshot: ShopSnapshot | null) {
  if (!snapshot) {
    return {
      access_mode: "Not surfaced",
      access_reason: "Authorized shop snapshot is not available for this device.",
    };
  }

  const normalizedType = asText(deviceType).toLowerCase();
  const accessMode =
    normalizedType === "workstation"
      ? snapshot.access.workstation_mode
      : snapshot.access.desktop_mode;

  return {
    access_mode: accessMode.replaceAll("_", " "),
    access_reason: snapshot.access.summary,
  };
}

function computeUpdateStatus(currentVersion: string | null, policy: DeviceUpdatePolicyRow | null) {
  if (!policy || (!policy.min_version && !policy.pinned_version)) {
    return {
      update_status: "not_surfaced" as const,
      update_label: "No policy",
      update_detail: "No update policy is currently stored for this shop.",
    };
  }

  if (!currentVersion) {
    return {
      update_status: "warning" as const,
      update_label: "Unknown version",
      update_detail: "The device has not reported a current app version yet.",
    };
  }

  if (policy.pinned_version && normVer(currentVersion) !== normVer(policy.pinned_version)) {
    return {
      update_status: "required" as const,
      update_label: "Pinned mismatch",
      update_detail: `Pinned version ${policy.pinned_version} is required.`,
    };
  }

  if (policy.min_version) {
    const comparison = cmpVer(currentVersion, policy.min_version);
    if (comparison === null) {
      return {
        update_status: "warning" as const,
        update_label: "Version format",
        update_detail: `Current version ${currentVersion} could not be compared to minimum ${policy.min_version}.`,
      };
    }
    if (comparison < 0) {
      return {
        update_status: "required" as const,
        update_label: "Below minimum",
        update_detail: `Minimum version ${policy.min_version} is required.`,
      };
    }
  }

  return {
    update_status: "current" as const,
    update_label: "Current",
    update_detail: policy.pinned_version
      ? `Matches pinned version ${policy.pinned_version}.`
      : policy.min_version
        ? `Meets minimum version ${policy.min_version}.`
        : "Current policy requirements are satisfied.",
  };
}

async function loadDeviceRows(admin: ReturnType<typeof supabaseAdmin>) {
  const columns = [
    "id",
    "shop_id",
    "name",
    "status",
    "created_at",
    "last_seen_at",
    "reported_version",
    "device_type",
    "rb_shops(name)",
  ];

  let working = [...columns];
  for (let attempt = 0; attempt < columns.length; attempt += 1) {
    const { data, error } = await admin
      .from("rb_devices")
      .select(working.join(","))
      .order("created_at", { ascending: false })
      .limit(500);

    if (!error) {
      return asArray<DeviceWithShopJoin>(data).map((row) => {
        const joinValue = Array.isArray(row.rb_shops) ? row.rb_shops[0] ?? null : row.rb_shops ?? null;
        return {
          id: asText(row.id),
          shop_id: isoOrNull(row.shop_id),
          shop_name: isoOrNull(joinValue?.name),
          name: asText(row.name) || "Unnamed device",
          status: isoOrNull(row.status),
          created_at: isoOrNull(row.created_at),
          last_seen_at: isoOrNull(row.last_seen_at),
          reported_version: isoOrNull(row.reported_version),
          device_type: isoOrNull(row.device_type),
        } satisfies DeviceBaseRow;
      });
    }

    const missingColumn = tryExtractMissingColumn(String(error.message ?? ""));
    if (missingColumn && working.includes(missingColumn)) {
      working = working.filter((column) => column !== missingColumn);
      continue;
    }

    throw new Error(error.message);
  }

  throw new Error("Unable to load devices.");
}

async function loadTokensByDevice(admin: ReturnType<typeof supabaseAdmin>, deviceIds: string[]) {
  const tokenMap = new Map<string, DeviceTokenRow[]>();
  if (deviceIds.length === 0) return tokenMap;

  const { data, error } = await admin
    .from("rb_device_tokens")
    .select("id,device_id,created_at,issued_at,revoked_at,last_seen_at,label")
    .in("device_id", deviceIds);

  if (error) throw new Error(error.message);

  for (const row of asArray<DeviceTokenDbRow>(data)) {
    const deviceId = asText(row.device_id);
    if (!deviceId) continue;
    const tokenRow: DeviceTokenRow = {
      id: asText(row.id),
      device_id: deviceId,
      created_at: isoOrNull(row.created_at),
      issued_at: isoOrNull(row.issued_at),
      revoked_at: isoOrNull(row.revoked_at),
      last_seen_at: isoOrNull(row.last_seen_at),
      label: isoOrNull(row.label),
    };

    const existing = tokenMap.get(deviceId) ?? [];
    existing.push(tokenRow);
    tokenMap.set(deviceId, existing);
  }

  for (const [deviceId, rows] of tokenMap.entries()) {
    rows.sort((left, right) => String(right.created_at ?? "").localeCompare(String(left.created_at ?? "")));
    tokenMap.set(deviceId, rows);
  }

  return tokenMap;
}

async function loadCapabilitiesByDevice(admin: ReturnType<typeof supabaseAdmin>, deviceIds: string[]) {
  const capabilityMap = new Map<string, DeviceCapabilityRow>();
  if (deviceIds.length === 0) return capabilityMap;

  try {
    // Capability snapshots are support/admin telemetry reported by RunBook Desktop during
    // Desktop-controlled onboarding and device check-in. Control stores and displays them
    // for platform-admin diagnostics only; they are not local manufacturing authority data.
    const { data, error } = await admin
      .from("rb_device_capability_snapshots")
      .select("device_id,reported_at,os_name,os_version,cpu_model,logical_cores,total_ram_bytes,system_drive_total_bytes,system_drive_free_bytes,gpu_name,requirements_status,requirements_failures,raw_payload")
      .in("device_id", deviceIds)
      .order("reported_at", { ascending: false });

    if (error) return capabilityMap;

    for (const row of asArray<CapabilityDbRow>(data)) {
      const deviceId = asText(row.device_id);
      if (!deviceId || capabilityMap.has(deviceId)) continue;
      capabilityMap.set(deviceId, {
        device_id: deviceId,
        reported_at: isoOrNull(row.reported_at),
        os_name: isoOrNull(row.os_name),
        os_version: isoOrNull(row.os_version),
        cpu_model: isoOrNull(row.cpu_model),
        logical_cores: asNullableNumber(row.logical_cores),
        total_ram_bytes: asNullableNumber(row.total_ram_bytes),
        system_drive_total_bytes: asNullableNumber(row.system_drive_total_bytes),
        system_drive_free_bytes: asNullableNumber(row.system_drive_free_bytes),
        gpu_name: isoOrNull(row.gpu_name),
        requirements_status: isoOrNull(row.requirements_status),
        requirements_failures: row.requirements_failures,
        raw_payload: row.raw_payload,
      });
    }
  } catch {
    return capabilityMap;
  }

  return capabilityMap;
}

async function loadUpdatePoliciesByShop(admin: ReturnType<typeof supabaseAdmin>, shopIds: string[]) {
  const policyMap = new Map<string, DeviceUpdatePolicyRow>();
  if (shopIds.length === 0) return policyMap;

  try {
    const { data, error } = await admin
      .from("rb_update_policy")
      .select("shop_id,channel,min_version,pinned_version")
      .in("shop_id", shopIds);

    if (error) return policyMap;

    for (const row of asArray<PolicyDbRow>(data)) {
      const shopId = asText(row.shop_id);
      if (!shopId) continue;
      policyMap.set(shopId, {
        shop_id: shopId,
        channel: isoOrNull(row.channel),
        min_version: isoOrNull(row.min_version),
        pinned_version: isoOrNull(row.pinned_version),
      });
    }
  } catch {
    return policyMap;
  }

  return policyMap;
}

async function loadSnapshotsByShop(context: ViewerContext) {
  const snapshots = await Promise.all(context.shops.map((shop) => getShopSnapshot(shop)));
  return new Map(snapshots.map((snapshot) => [snapshot.id, snapshot]));
}

export async function loadDeviceViewRows() {
  const context = await getViewerContext();
  const admin = supabaseAdmin();
  const [devices, shopSnapshotsById] = await Promise.all([
    loadDeviceRows(admin),
    loadSnapshotsByShop(context),
  ]);

  const deviceIds = devices.map((device) => device.id);
  const shopIds = devices.map((device) => asText(device.shop_id)).filter(Boolean);
  const [tokensByDevice, capabilitiesByDevice, policiesByShop] = await Promise.all([
    loadTokensByDevice(admin, deviceIds),
    loadCapabilitiesByDevice(admin, deviceIds),
    loadUpdatePoliciesByShop(admin, [...new Set(shopIds)]),
  ]);

  const rows = devices.map((device) => {
    const shopSnapshot = device.shop_id ? shopSnapshotsById.get(device.shop_id) ?? null : null;
    const tokens = tokensByDevice.get(device.id) ?? [];
    const activeTokens = tokens.filter((token) => !token.revoked_at);
    const latestTokenSeenAt = activeTokens.reduce<string | null>((latest, token) => newestIso(latest, token.last_seen_at), null);
    const latestTokenIssuedAt = tokens.reduce<string | null>((latest, token) => newestIso(latest, token.issued_at, token.created_at), null);
    const mergedLastSeenAt = newestIso(device.last_seen_at, latestTokenSeenAt);
    const updatePolicy = device.shop_id ? policiesByShop.get(device.shop_id) ?? null : null;
    const capability = capabilitiesByDevice.get(device.id) ?? null;
    const access = computeAccessMode(device.device_type, shopSnapshot);
    const updateState = computeUpdateStatus(device.reported_version, updatePolicy);

    return {
      ...device,
      merged_last_seen_at: mergedLastSeenAt,
      access_mode: access.access_mode,
      access_reason: access.access_reason,
      shop_snapshot: shopSnapshot,
      active_token_count: activeTokens.length,
      latest_token_issued_at: latestTokenIssuedAt,
      latest_token_seen_at: latestTokenSeenAt,
      update_policy: updatePolicy,
      update_status: updateState.update_status,
      update_label: updateState.update_label,
      update_detail: updateState.update_detail,
      capability,
      capability_warning: computeCapabilityWarning(capability),
    } satisfies DeviceViewRow;
  });

  return {
    context,
    rows,
  };
}

export async function loadDeviceDetail(deviceId: string) {
  const { context, rows } = await loadDeviceViewRows();
  const device = rows.find((row) => row.id === deviceId) ?? null;
  if (!device) {
    return {
      context,
      device: null,
      tokens: [] as DeviceTokenRow[],
      auditRows: [] as Array<{ id: string; action: string; actor_email: string | null; created_at: string | null; target_type: string | null; target_id: string | null }>,
      supportRows: [] as Array<{ id: string; file_path: string | null; notes: string | null; uploaded_by: string | null; created_at: string | null }>,
    };
  }

  const admin = supabaseAdmin();
  const [tokensByDevice, auditResult, supportResult] = await Promise.all([
    loadTokensByDevice(admin, [deviceId]),
    admin
      .from("rb_audit_log")
      .select("id,action,actor_email,created_at,target_type,target_id")
      .eq("target_id", deviceId)
      .order("created_at", { ascending: false })
      .limit(12),
    device.shop_id
      ? admin
          .from("rb_support_bundles")
          .select("id,file_path,notes,uploaded_by,created_at")
          .eq("shop_id", device.shop_id)
          .order("created_at", { ascending: false })
          .limit(6)
      : Promise.resolve({ data: [] as Array<{ id: string | null; file_path: string | null; notes: string | null; uploaded_by: string | null; created_at: string | null }>, error: null }),
  ]);

  const tokens = tokensByDevice.get(deviceId) ?? [];
  const auditRows = auditResult.error
    ? []
    : asArray<{ id: string | null; action: string | null; actor_email: string | null; created_at: string | null; target_type: string | null; target_id: string | null }>(auditResult.data).map((row) => ({
        id: asText(row.id),
        action: asText(row.action) || "event",
        actor_email: isoOrNull(row.actor_email),
        created_at: isoOrNull(row.created_at),
        target_type: isoOrNull(row.target_type),
        target_id: isoOrNull(row.target_id),
      }));

  const supportRows = supportResult.error
    ? []
    : asArray<{ id: string | null; file_path: string | null; notes: string | null; uploaded_by: string | null; created_at: string | null }>(supportResult.data).map((row) => ({
        id: asText(row.id),
        file_path: isoOrNull(row.file_path),
        notes: isoOrNull(row.notes),
        uploaded_by: isoOrNull(row.uploaded_by),
        created_at: isoOrNull(row.created_at),
      }));

  return {
    context,
    device,
    tokens,
    auditRows,
    supportRows,
  };
}

export function capabilityStatusLabel(capability: DeviceCapabilityRow | null) {
  if (!capability) return "Not surfaced";
  return humanizeStatus(capability.requirements_status, "Reported");
}

export function capabilityMessages(capability: DeviceCapabilityRow | null) {
  return extractRequirementMessages(capability);
}
