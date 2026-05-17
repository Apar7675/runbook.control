import { getViewerContext, type ViewerContext } from "@/lib/control/summary";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type UpdatePackageViewRow = {
  id: string;
  channel: string | null;
  version: string | null;
  file_path: string | null;
  notes: string | null;
  sha256: string | null;
  created_at: string | null;
  updated_at: string | null;
  created_by: string | null;
  min_required_label: string;
  pinned_label: string;
  affected_devices: number | null;
  status_label: string;
};

export type UpdateViewsData = {
  context: ViewerContext;
  rows: UpdatePackageViewRow[];
  summary: {
    totalPackages: number;
    stablePackages: number;
    minimumVersionLabel: string;
    pinnedVersionLabel: string;
    devicesBehind: number;
  };
};

type UpdatePackageDbRow = {
  id: string | null;
  channel: string | null;
  version: string | null;
  file_path: string | null;
  notes: string | null;
  sha256: string | null;
  created_at: string | null;
  updated_at: string | null;
  created_by: string | null;
};

type UpdatePolicyDbRow = {
  id?: string | null;
  shop_id: string | null;
  channel: string | null;
  min_version: string | null;
  pinned_version: string | null;
  created_at?: string | null;
};

type DeviceVersionDbRow = {
  id: string | null;
  shop_id: string | null;
  reported_version: string | null;
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

function tryExtractMissingColumn(message: string): string | null {
  const relationMatch = message.match(/column\s+"([^"]+)"\s+of\s+relation/i);
  if (relationMatch?.[1]) return relationMatch[1];

  const schemaCacheMatch = message.match(/Could not find the '([^']+)' column/i);
  if (schemaCacheMatch?.[1]) return schemaCacheMatch[1];

  const qualifiedMatch = message.match(/column\s+[a-zA-Z0-9_]+\.(\w+)\s+does\s+not\s+exist/i);
  if (qualifiedMatch?.[1]) return qualifiedMatch[1];

  return null;
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

function humanize(value: string | null | undefined, fallback: string) {
  const text = asText(value);
  return text ? text.replaceAll("_", " ") : fallback;
}

async function loadPackages() {
  const admin = supabaseAdmin();
  const selectNew = ["id", "channel", "version", "file_path", "notes", "sha256", "created_at", "updated_at", "created_by"];
  const selectOld = ["id", "channel", "version", "file_path", "notes", "sha256", "created_at", "created_by"];

  let working = [...selectNew];
  for (let attempt = 0; attempt < selectNew.length; attempt += 1) {
    const { data, error } = await admin
      .from("rb_update_packages")
      .select(working.join(","))
      .order("created_at", { ascending: false })
      .limit(500);

    if (!error) return asArray<UpdatePackageDbRow>(data);

    const missing = tryExtractMissingColumn(String(error.message ?? ""));
    if (missing && working.includes(missing)) {
      working = working.filter((column) => column !== missing);
      continue;
    }

    break;
  }

  const { data, error } = await admin
    .from("rb_update_packages")
    .select(selectOld.join(","))
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) throw new Error(error.message);
  return asArray<UpdatePackageDbRow>(data);
}

async function loadPolicies(shopIds: string[]) {
  const ids = [...new Set(shopIds.filter(Boolean))];
  if (ids.length === 0) return [] as UpdatePolicyDbRow[];

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("rb_update_policy")
    .select("shop_id,channel,min_version,pinned_version,created_at")
    .in("shop_id", ids);

  if (error) return [] as UpdatePolicyDbRow[];
  return asArray<UpdatePolicyDbRow>(data);
}

async function loadDevices(shopIds: string[]) {
  const ids = [...new Set(shopIds.filter(Boolean))];
  if (ids.length === 0) return [] as DeviceVersionDbRow[];

  const admin = supabaseAdmin();
  const columns = ["id", "shop_id", "reported_version"];
  let working = [...columns];

  for (let attempt = 0; attempt < columns.length; attempt += 1) {
    const { data, error } = await admin
      .from("rb_devices")
      .select(working.join(","))
      .in("shop_id", ids)
      .limit(2000);

    if (!error) return asArray<DeviceVersionDbRow>(data);

    const missing = tryExtractMissingColumn(String(error.message ?? ""));
    if (missing && working.includes(missing)) {
      working = working.filter((column) => column !== missing);
      continue;
    }
    return [] as DeviceVersionDbRow[];
  }

  return [] as DeviceVersionDbRow[];
}

export async function loadUpdateViews(): Promise<UpdateViewsData> {
  const context = await getViewerContext();
  const shopIds = context.shops.map((shop) => shop.id);
  const [packagesRaw, policies, devices] = await Promise.all([
    loadPackages(),
    loadPolicies(shopIds),
    loadDevices(shopIds),
  ]);

  const minVersionCounts = new Map<string, number>();
  const pinnedVersionCounts = new Map<string, number>();
  const affectedDeviceIdsByVersion = new Map<string, Set<string>>();

  for (const policy of policies) {
    const minVersion = asText(policy.min_version);
    const pinnedVersion = asText(policy.pinned_version);

    if (minVersion) minVersionCounts.set(minVersion, (minVersionCounts.get(minVersion) ?? 0) + 1);
    if (pinnedVersion) pinnedVersionCounts.set(pinnedVersion, (pinnedVersionCounts.get(pinnedVersion) ?? 0) + 1);

    const shopDevices = devices.filter((device) => asText(device.shop_id) === asText(policy.shop_id));
    for (const device of shopDevices) {
      const deviceId = asText(device.id);
      const reportedVersion = asText(device.reported_version);
      if (!deviceId) continue;

      if (minVersion) {
        const set = affectedDeviceIdsByVersion.get(minVersion) ?? new Set<string>();
        const comparison = reportedVersion ? cmpVer(reportedVersion, minVersion) : null;
        if (!reportedVersion || comparison === null || comparison < 0) set.add(deviceId);
        affectedDeviceIdsByVersion.set(minVersion, set);
      }

      if (pinnedVersion) {
        const set = affectedDeviceIdsByVersion.get(pinnedVersion) ?? new Set<string>();
        if (!reportedVersion || normVer(reportedVersion) !== normVer(pinnedVersion)) set.add(deviceId);
        affectedDeviceIdsByVersion.set(pinnedVersion, set);
      }
    }
  }

  const rows = packagesRaw.map((row) => {
    const version = isoOrNull(row.version);
    const minRefs = version ? minVersionCounts.get(version) ?? 0 : 0;
    const pinRefs = version ? pinnedVersionCounts.get(version) ?? 0 : 0;
    const affectedDevices = version ? affectedDeviceIdsByVersion.get(version)?.size ?? 0 : 0;

    let statusLabel = "Inventory only";
    if (!row.file_path) statusLabel = "Missing path";
    else if (pinRefs > 0 && minRefs > 0) statusLabel = "Pinned + minimum";
    else if (pinRefs > 0) statusLabel = "Pinned target";
    else if (minRefs > 0) statusLabel = "Minimum target";

    return {
      id: asText(row.id),
      channel: isoOrNull(row.channel),
      version,
      file_path: isoOrNull(row.file_path),
      notes: isoOrNull(row.notes),
      sha256: isoOrNull(row.sha256),
      created_at: isoOrNull(row.created_at),
      updated_at: isoOrNull(row.updated_at),
      created_by: isoOrNull(row.created_by),
      min_required_label: minRefs > 0 ? `${minRefs} shop${minRefs === 1 ? "" : "s"}` : "Shop-specific",
      pinned_label: pinRefs > 0 ? `${pinRefs} shop${pinRefs === 1 ? "" : "s"}` : "Shop-specific",
      affected_devices: version ? affectedDevices : null,
      status_label: statusLabel,
    } satisfies UpdatePackageViewRow;
  });

  const minimumVersions = [...new Set(policies.map((policy) => asText(policy.min_version)).filter(Boolean))];
  const pinnedVersions = [...new Set(policies.map((policy) => asText(policy.pinned_version)).filter(Boolean))];
  let devicesBehind = 0;
  for (const set of affectedDeviceIdsByVersion.values()) devicesBehind += set.size;

  return {
    context,
    rows,
    summary: {
      totalPackages: rows.length,
      stablePackages: rows.filter((row) => asText(row.channel).toLowerCase() === "stable").length,
      minimumVersionLabel: minimumVersions.length === 0 ? "Not surfaced" : minimumVersions.length === 1 ? minimumVersions[0] : `${minimumVersions.length} shop-specific minimums`,
      pinnedVersionLabel: pinnedVersions.length === 0 ? "Not surfaced" : pinnedVersions.length === 1 ? pinnedVersions[0] : `${pinnedVersions.length} shop-specific pins`,
      devicesBehind,
    },
  };
}

export function updateStatusTone(label: string) {
  const normalized = label.toLowerCase();
  if (normalized.includes("missing") || normalized.includes("pinned")) return "danger" as const;
  if (normalized.includes("minimum")) return "warning" as const;
  if (normalized.includes("inventory")) return "neutral" as const;
  return "info" as const;
}

export function humanizeUpdateValue(value: string | null | undefined, fallback: string) {
  return humanize(value, fallback);
}
