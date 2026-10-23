import { supabaseAdmin } from "@/lib/supabase/admin";
import { formatDateTime } from "@/lib/ui/dates";
import { compareSoftwareVersions, parseSoftwareVersion, completeSoftwarePackage, softwarePackageMatchesApp } from "@/lib/control/softwareUpdatePolicy";
import type { ControlStatusTone } from "@/components/control/ControlStatusChip";

export type WorkspaceTabKey = "overview" | "releases" | "devices" | "rollouts" | "upload-package" | "settings";

export type SoftwareUpdateOverviewStat = {
  label: string;
  value: string;
  meta: string;
  tone: ControlStatusTone;
};

export type SoftwareUpdateReleaseRow = {
  id?: string;
  app: string;
  version: string;
  channel: string;
  status: string;
  intent: string;
  released: string;
  packageName: string;
};

export type SoftwareReleaseRecord = {
  id: string;
  app_name: string;
  version: string;
  channel: string;
  status: string;
  required: boolean;
  release_intent: string;
  release_notes: string;
  minimum_supported_version: string;
  rollback_version: string;
  package_url: string;
  package_file_name: string;
  package_sha256: string;
  package_size_bytes: string;
  package_uploaded_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  published_at: string | null;
};

export type SoftwarePackageRecord = {
  id: string;
  release_id: string;
  file_name: string;
  storage_path: string;
  download_url: string;
  sha256: string;
  size_bytes: string;
  platform: string;
  architecture: string;
  created_at: string | null;
};

export type SoftwareUpdateDeviceRow = {
  pendingReleaseId?: string;
  device: string;
  shop: string;
  desktop: string;
  service: string;
  workstation: string;
  mobile: string;
  channel: string;
  status: string;
  lastCheck: string;
  lastError: string;
};

export type SoftwareUpdateRolloutRow = {
  id?: string;
  release: string;
  target: string;
  channel: string;
  required: string;
  status: string;
  starts: string;
  progress: string;
};

export type SoftwareRolloutRecord = {
  id: string;
  release_id: string;
  target_type: string;
  target_shop_id: string;
  target_device_id: string;
  channel: string;
  required: boolean;
  status: string;
  starts_at: string;
  created_at: string | null;
  updated_at: string | null;
};

export type SoftwareTargetOption = {
  id: string;
  label: string;
};

export type SoftwareReleaseReadinessState = "ready" | "missing" | "review" | "not-tracked-yet";

export type SoftwareReleaseReadinessItem = {
  key: string;
  label: string;
  state: SoftwareReleaseReadinessState;
  detail: string;
};

export type SoftwareReleasePublishReadiness = {
  items: SoftwareReleaseReadinessItem[];
  readyCount: number;
  missingCount: number;
  reviewCount: number;
  notTrackedCount: number;
  isComplete: boolean;
  packageMetadataIncomplete: boolean;
  hasValidChecksum: boolean;
};

export type SoftwareUpdatesWorkspaceData = {
  sourceKind: "demo" | "mixed" | "live" | "unavailable";
  availabilityMessage: string | null;
  schemaAvailable: boolean;
  releaseCrudEnabled: boolean;
  packageCrudEnabled: boolean;
  rolloutCrudEnabled: boolean;
  overviewStats: SoftwareUpdateOverviewStat[];
  releaseRows: SoftwareUpdateReleaseRow[];
  releaseRecords: SoftwareReleaseRecord[];
  packageRecords: SoftwarePackageRecord[];
  rolloutRecords: SoftwareRolloutRecord[];
  shopOptions: SoftwareTargetOption[];
  deviceOptions: SoftwareTargetOption[];
  deviceRows: SoftwareUpdateDeviceRow[];
  rolloutRows: SoftwareUpdateRolloutRow[];
};

type ReleaseDbRow = {
  id: string | null;
  app_name: string | null;
  version: string | null;
  channel: string | null;
  status: string | null;
  required: boolean | null;
  release_intent: string | null;
  release_notes: string | null;
  minimum_supported_version: string | null;
  rollback_version: string | null;
  package_url: string | null;
  package_file_name: string | null;
  package_sha256: string | null;
  package_size_bytes: number | null;
  package_uploaded_at: string | null;
  published_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type PackageDbRow = {
  id: string | null;
  release_id: string | null;
  file_name: string | null;
  storage_path: string | null;
  download_url: string | null;
  sha256: string | null;
  size_bytes: number | null;
  platform: string | null;
  architecture: string | null;
  created_at: string | null;
};

type DeviceStatusDbRow = {
  id: string | null;
  shop_id: string | null;
  device_id: string | null;
  device_name: string | null;
  desktop_version: string | null;
  service_version: string | null;
  workstation_version: string | null;
  mobile_version: string | null;
  channel: string | null;
  update_status: string | null;
  pending_release_id: string | null;
  last_check_at: string | null;
  last_error: string | null;
};

type RolloutDbRow = {
  id: string | null;
  release_id: string | null;
  target_type: string | null;
  target_shop_id: string | null;
  target_device_id: string | null;
  channel: string | null;
  required: boolean | null;
  status: string | null;
  starts_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type ShopDbRow = {
  id: string | null;
  name: string | null;
};

type DeviceDbRow = {
  id: string | null;
  name: string | null;
};

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asText(value: unknown) {
  return String(value ?? "").trim();
}

function titleCaseApp(value: string) {
  const text = asText(value).toLowerCase();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "Unknown";
}

function formatMaybeDateTime(value: string | null | undefined, fallback: string) {
  const text = asText(value);
  if (!text) return fallback;
  try {
    return formatDateTime(text);
  } catch {
    return text;
  }
}

function resolveReleaseIntent(intent: string | null | undefined, required: boolean | null | undefined) {
  const normalized = asText(intent).toLowerCase();
  if (normalized === "optional" || normalized === "recommended" || normalized === "required") return normalized;
  return required ? "required" : "optional";
}

function isValidChecksum(value: string) {
  return /^[0-9a-f]{64}$/i.test(asText(value));
}

function isPositiveWholeNumber(value: string) {
  const parsed = Number(asText(value));
  return Number.isFinite(parsed) && Number.isInteger(parsed) && parsed > 0;
}

export function deriveReleasePublishReadiness(release: SoftwareReleaseRecord, packages: SoftwarePackageRecord[] = []): SoftwareReleasePublishReadiness {
  const resolvedIntent = resolveReleaseIntent(release.release_intent, release.required);
  const packageRows = packages.filter((row) => row.release_id === release.id)
    .map((row) => ({ ...row, size_bytes: row.size_bytes ? Number(row.size_bytes) : null }));
  const linkedPackage = packageRows.find((row) =>
    completeSoftwarePackage(row) && softwarePackageMatchesApp(row, release.app_name));
  const checksumText = asText(linkedPackage?.sha256 ?? release.package_sha256);
  const sizeText = asText(linkedPackage?.size_bytes ?? release.package_size_bytes);

  const items: SoftwareReleaseReadinessItem[] = [
    {
      key: "app_name",
      label: "App",
      state: asText(release.app_name) ? "ready" : "missing",
      detail: asText(release.app_name) ? `App recorded as ${release.app_name}.` : "Choose which RunBook app this release belongs to.",
    },
    {
      key: "version",
      label: "Version",
      state: !asText(release.version) ? "missing" : parseSoftwareVersion(release.version) ? "ready" : "review",
      detail: asText(release.version) ? `Version ${release.version} is recorded.` : "Add a release version before publishing.",
    },
    {
      key: "release_intent",
      label: "Release Intent",
      state: resolvedIntent ? "ready" : "missing",
      detail: resolvedIntent
        ? `Intent resolves to ${resolvedIntent}.`
        : "Choose optional, recommended, or required intent.",
    },
    {
      key: "release_notes",
      label: "Release Notes",
      state: asText(release.release_notes) ? "ready" : "missing",
      detail: asText(release.release_notes) ? "Release notes are recorded." : "Add operator-facing release notes.",
    },
    {
      key: "package_url",
      label: "Package URL",
      state: linkedPackage ? "ready" : "missing",
      detail: linkedPackage ? "A complete linked package location is recorded." : "Add a complete linked package row; inline metadata alone is not deliverable.",
    },
    {
      key: "package_file_name",
      label: "Package File Name",
      state: linkedPackage ? "ready" : "missing",
      detail: linkedPackage ? "A complete linked package file name is recorded." : "Add a complete linked package row.",
    },
    {
      key: "package_sha256",
      label: "Package SHA256",
      state: !checksumText ? "missing" : linkedPackage && isValidChecksum(checksumText) ? "ready" : "review",
      detail: !checksumText
        ? "Record a SHA256 checksum."
        : isValidChecksum(checksumText)
          ? "Checksum looks valid."
          : "Checksum is present but does not look like a 64-character hex value.",
    },
    {
      key: "package_size_bytes",
      label: "Package Size",
      state: !sizeText ? "missing" : linkedPackage && isPositiveWholeNumber(sizeText) ? "ready" : "review",
      detail: !sizeText
        ? "Record package size in bytes."
        : isPositiveWholeNumber(sizeText)
          ? "Package size is recorded."
          : "Package size is present but should be a positive whole number.",
    },
    {
      key: "minimum_supported_version",
      label: "Minimum Supported Version",
      state: asText(release.minimum_supported_version) ? "review" : "missing",
      detail: asText(release.minimum_supported_version)
        ? `Review minimum supported version ${release.minimum_supported_version} before publishing.`
        : "Review whether a minimum supported version should be recorded.",
    },
    {
      key: "rollback_version",
      label: "Rollback Version",
      state: asText(release.rollback_version) ? "review" : "missing",
      detail: asText(release.rollback_version)
        ? `Review rollback version ${release.rollback_version} before publishing.`
        : "Review whether a rollback version should be recorded.",
    },
  ];

  const readyCount = items.filter((item) => item.state === "ready").length;
  const missingCount = items.filter((item) => item.state === "missing").length;
  const reviewCount = items.filter((item) => item.state === "review").length;
  const notTrackedCount = items.filter((item) => item.state === "not-tracked-yet").length;
  const packageMetadataIncomplete = items.some((item) =>
    ["package_url", "package_file_name", "package_sha256", "package_size_bytes"].includes(item.key) && item.state !== "ready",
  );

  return {
    items,
    readyCount,
    missingCount,
    reviewCount,
    notTrackedCount,
    isComplete: missingCount === 0 && reviewCount === 0,
    packageMetadataIncomplete,
    hasValidChecksum: isValidChecksum(checksumText),
  };
}

function isMissingRelationError(message: string) {
  const text = String(message ?? "").toLowerCase();
  return text.includes("does not exist") || text.includes("could not find the table") || text.includes("schema cache");
}

export function buildUnavailableSoftwareUpdatesData(
  message = "Software update data is unavailable. No release, device or rollout status has been loaded.",
): SoftwareUpdatesWorkspaceData {
  return {
    sourceKind: "unavailable",
    availabilityMessage: message,
    schemaAvailable: false,
    releaseCrudEnabled: false,
    packageCrudEnabled: false,
    rolloutCrudEnabled: false,
    overviewStats: [],
    releaseRows: [],
    releaseRecords: [],
    packageRecords: [],
    rolloutRecords: [],
    shopOptions: [],
    deviceOptions: [],
    deviceRows: [],
    rolloutRows: [],
  };
}

function targetLabel(row: RolloutDbRow, shopNames: Map<string, string>, deviceNames: Map<string, string>) {
  const type = asText(row.target_type).toLowerCase();
  if (type === "all") return "All shops/devices";
  if (type === "beta") return "Beta channel devices";
  if (type === "shop") return `Shop: ${shopNames.get(asText(row.target_shop_id)) ?? "Target shop"}`;
  if (type === "device") return `Device: ${deviceNames.get(asText(row.target_device_id)) ?? "Target device"}`;
  return "Target not labeled";
}

function currentReleaseForApp(rows: ReleaseDbRow[], appName: string) {
  return rows.filter((row) =>
    asText(row.app_name).toLowerCase() === appName &&
    asText(row.status).toLowerCase() === "active" && parseSoftwareVersion(row.version))
    .sort((a, b) => (compareSoftwareVersions(b.version, a.version) ?? 0) || asText(a.id).localeCompare(asText(b.id)))[0] ?? null;
}

export async function loadSoftwareUpdatesWorkspaceData(): Promise<SoftwareUpdatesWorkspaceData> {

  try {
    const admin = supabaseAdmin();
    const [releasesResult, packagesResult, deviceStatusesResult, rolloutsResult] = await Promise.all([
      admin
        .from("rb_software_releases")
        .select("id,app_name,version,channel,status,required,release_intent,release_notes,minimum_supported_version,rollback_version,package_url,package_file_name,package_sha256,package_size_bytes,package_uploaded_at,published_at,created_at,updated_at")
        .order("created_at", { ascending: false })
        .limit(200),
      admin
        .from("rb_software_packages")
        .select("id,release_id,file_name,storage_path,download_url,sha256,size_bytes,platform,architecture,created_at")
        .limit(400),
      admin
        .from("rb_device_software_status")
        .select("id,shop_id,device_id,device_name,desktop_version,service_version,workstation_version,mobile_version,channel,update_status,pending_release_id,last_check_at,last_error")
        .order("updated_at", { ascending: false })
        .limit(500),
      admin
        .from("rb_software_rollouts")
        .select("id,release_id,target_type,target_shop_id,target_device_id,channel,required,status,starts_at,created_at,updated_at")
        .order("created_at", { ascending: false })
        .limit(300),
    ]);

    const allErrors = [releasesResult.error, packagesResult.error, deviceStatusesResult.error, rolloutsResult.error].filter(Boolean);
    if (allErrors.some((error) => isMissingRelationError(String(error?.message ?? "")))) {
      return buildUnavailableSoftwareUpdatesData();
    }
    if (allErrors.length > 0) {
      return buildUnavailableSoftwareUpdatesData();
    }

    const releases = asArray<ReleaseDbRow>(releasesResult.data);
    const packages = asArray<PackageDbRow>(packagesResult.data);
    const deviceStatuses = asArray<DeviceStatusDbRow>(deviceStatusesResult.data);
    const rollouts = asArray<RolloutDbRow>(rolloutsResult.data);

    const shopIds = [...new Set([
      ...deviceStatuses.map((row) => asText(row.shop_id)),
      ...rollouts.map((row) => asText(row.target_shop_id)),
    ].filter(Boolean))];

    const deviceIds = [...new Set([
      ...deviceStatuses.map((row) => asText(row.device_id)),
      ...rollouts.map((row) => asText(row.target_device_id)),
    ].filter(Boolean))];

    const [shopsResult, devicesResult] = await Promise.all([
      shopIds.length > 0
        ? admin.from("rb_shops").select("id,name").in("id", shopIds)
        : Promise.resolve({ data: [], error: null }),
      deviceIds.length > 0
        ? admin.from("rb_devices").select("id,name").in("id", deviceIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (shopsResult.error || devicesResult.error) {
      return buildUnavailableSoftwareUpdatesData("Software update target data could not be loaded. No fleet status has been loaded.");
    }

    const shopNames = new Map(asArray<ShopDbRow>(shopsResult.data).map((row) => [asText(row.id), asText(row.name) || "Unnamed shop"]));
    const deviceNames = new Map(asArray<DeviceDbRow>(devicesResult.data).map((row) => [asText(row.id), asText(row.name) || "Unnamed device"]));
    const shopOptions = [...shopNames.entries()].map(([id, label]) => ({ id, label }));
    const deviceOptions = [...deviceNames.entries()].map(([id, label]) => ({ id, label }));
    const packageNames = new Map<string, string>();
    const packageCounts = new Map<string, number>();
    for (const row of packages) {
      const releaseId = asText(row.release_id);
      if (!releaseId) continue;
      if (!packageNames.has(releaseId)) packageNames.set(releaseId, asText(row.file_name) || "Package recorded");
      packageCounts.set(releaseId, (packageCounts.get(releaseId) ?? 0) + 1);
    }

    const releaseLabelById = new Map<string, string>();
    for (const row of releases) {
      const id = asText(row.id);
      if (!id) continue;
      releaseLabelById.set(id, `${titleCaseApp(asText(row.app_name))} ${asText(row.version) || "Unknown"}`);
    }

    const releaseRecords: SoftwareReleaseRecord[] = releases
      .map((row) => {
        const id = asText(row.id);
        if (!id) return null;
        return {
          id,
          app_name: asText(row.app_name),
          version: asText(row.version),
          channel: asText(row.channel) || "stable",
          status: asText(row.status) || "draft",
          required: !!row.required,
          release_intent: resolveReleaseIntent(row.release_intent, row.required),
          release_notes: asText(row.release_notes),
          minimum_supported_version: asText(row.minimum_supported_version),
          rollback_version: asText(row.rollback_version),
          package_url: asText(row.package_url),
          package_file_name: asText(row.package_file_name),
          package_sha256: asText(row.package_sha256),
          package_size_bytes: row.package_size_bytes === null || row.package_size_bytes === undefined ? "" : String(row.package_size_bytes),
          package_uploaded_at: asText(row.package_uploaded_at) || null,
          created_at: asText(row.created_at) || null,
          updated_at: asText(row.updated_at) || null,
          published_at: asText(row.published_at) || null,
        } satisfies SoftwareReleaseRecord;
      })
      .filter((row): row is SoftwareReleaseRecord => !!row);

    const packageRecords: SoftwarePackageRecord[] = packages
      .map((row) => {
        const id = asText(row.id);
        const releaseId = asText(row.release_id);
        if (!id || !releaseId) return null;
        return {
          id,
          release_id: releaseId,
          file_name: asText(row.file_name),
          storage_path: asText(row.storage_path),
          download_url: asText(row.download_url),
          sha256: asText(row.sha256),
          size_bytes: row.size_bytes === null || row.size_bytes === undefined ? "" : String(row.size_bytes),
          platform: asText(row.platform) || "windows",
          architecture: asText(row.architecture) || "x64",
          created_at: asText(row.created_at) || null,
        } satisfies SoftwarePackageRecord;
      })
      .filter((row): row is SoftwarePackageRecord => !!row);

    const rolloutRecords: SoftwareRolloutRecord[] = rollouts
      .map((row) => {
        const id = asText(row.id);
        const releaseId = asText(row.release_id);
        if (!id || !releaseId) return null;
        return {
          id,
          release_id: releaseId,
          target_type: asText(row.target_type) || "all",
          target_shop_id: asText(row.target_shop_id),
          target_device_id: asText(row.target_device_id),
          channel: asText(row.channel) || "stable",
          required: !!row.required,
          status: asText(row.status) || "planned",
          starts_at: asText(row.starts_at),
          created_at: asText(row.created_at) || null,
          updated_at: asText(row.updated_at) || null,
        } satisfies SoftwareRolloutRecord;
      })
      .filter((row): row is SoftwareRolloutRecord => !!row);

    const liveReleaseRows = releases.map((row) => ({
      id: asText(row.id) || undefined,
      app: titleCaseApp(asText(row.app_name)),
      version: asText(row.version) || "Unknown",
      channel: asText(row.channel) || "stable",
      status: asText(row.status) || "draft",
      intent: resolveReleaseIntent(row.release_intent, row.required),
      released: formatMaybeDateTime(row.published_at || row.created_at, "Not published"),
      packageName: (() => {
        const releaseId = asText(row.id);
        const releaseFileName = asText(row.package_file_name);
        const releaseUrl = asText(row.package_url);
        const count = packageCounts.get(releaseId) ?? 0;
        if (releaseFileName) return releaseFileName;
        if (releaseUrl) return "Release package URL recorded";
        if (count <= 0) return "Missing metadata";
        if (count === 1) return packageNames.get(releaseId) ?? "1 package";
        return `${count} packages`;
      })(),
    }));

    const liveDeviceRows = deviceStatuses.map((row) => ({
      pendingReleaseId: asText(row.pending_release_id) || undefined,
      device: asText(row.device_name) || deviceNames.get(asText(row.device_id)) || "Unnamed device",
      shop: shopNames.get(asText(row.shop_id)) ?? "Unassigned shop",
      desktop: asText(row.desktop_version) || "n/a",
      service: asText(row.service_version) || "n/a",
      workstation: asText(row.workstation_version) || "n/a",
      mobile: asText(row.mobile_version) || "n/a",
      channel: asText(row.channel) || "stable",
      status: asText(row.update_status).replaceAll("_", " ") || "unknown",
      lastCheck: formatMaybeDateTime(row.last_check_at, "No check reported"),
      lastError: asText(row.last_error) || "None reported",
    }));

    const releaseStatusCounts = new Map<string, number>();
    for (const row of deviceStatuses) {
      const releaseId = asText(row.pending_release_id);
      if (!releaseId) continue;
      releaseStatusCounts.set(releaseId, (releaseStatusCounts.get(releaseId) ?? 0) + 1);
    }

    const liveRolloutRows = rollouts.map((row) => {
      const releaseId = asText(row.release_id);
      const linkedStatuses = releaseStatusCounts.get(releaseId) ?? 0;
      return {
        id: asText(row.id) || undefined,
        release: releaseLabelById.get(releaseId) ?? "Unknown release",
        target: targetLabel(row, shopNames, deviceNames),
        channel: asText(row.channel) || "stable",
        required: row.required ? "required" : "optional",
        status: asText(row.status) || "planned",
        starts: formatMaybeDateTime(row.starts_at, "Not scheduled"),
        progress: linkedStatuses > 0 ? `${linkedStatuses} pending device status row${linkedStatuses === 1 ? "" : "s"}` : "No linked device status yet",
      };
    });

    const desktopRelease = currentReleaseForApp(releases, "desktop");
    const serviceRelease = currentReleaseForApp(releases, "service");
    const workstationRelease = currentReleaseForApp(releases, "workstation");
    const mobileRelease = currentReleaseForApp(releases, "mobile");

    const devicesCurrent = deviceStatuses.filter((row) => asText(row.update_status).toLowerCase() === "current").length;
    const devicesPending = deviceStatuses.filter((row) => ["available", "required", "installing", "pending_restart"].includes(asText(row.update_status).toLowerCase())).length;
    const failedInstalls = deviceStatuses.filter((row) => asText(row.update_status).toLowerCase() === "failed").length;
    const blockedDevices = deviceStatuses.filter((row) => asText(row.update_status).toLowerCase() === "blocked").length;

    const liveOverviewStats: SoftwareUpdateOverviewStat[] = [
      { label: "Latest Desktop Version", value: asText(desktopRelease?.version) || "Not surfaced", meta: "Read from rb_software_releases when available.", tone: desktopRelease ? "success" : "neutral" },
      { label: "Latest Service Version", value: asText(serviceRelease?.version) || "Not surfaced", meta: "Control metadata only. No local install behavior is implemented in this phase.", tone: serviceRelease ? "success" : "neutral" },
      { label: "Latest Workstation Version", value: asText(workstationRelease?.version) || "Not surfaced", meta: "Release visibility is database-backed when records exist.", tone: workstationRelease ? "success" : "neutral" },
      { label: "Mobile Minimum Version", value: asText(mobileRelease?.minimum_supported_version) || asText(mobileRelease?.version) || "Not surfaced", meta: "Control tracks minimum/current supported mobile versions only.", tone: mobileRelease ? "info" : "neutral" },
      { label: "Devices Current", value: String(devicesCurrent), meta: "Counted from rb_device_software_status rows currently marked current.", tone: devicesCurrent > 0 ? "success" : "neutral" },
      { label: "Devices Pending Update", value: String(devicesPending), meta: "Counted from statuses such as available, required, installing, and pending restart.", tone: devicesPending > 0 ? "warning" : "success" },
      { label: "Failed Installs", value: String(failedInstalls), meta: "Current failed count from device software status reporting.", tone: failedInstalls > 0 ? "danger" : "success" },
      { label: "Blocked Devices", value: String(blockedDevices), meta: "Devices reporting blocked status from Control-backed software status reporting.", tone: blockedDevices > 0 ? "danger" : "success" },
    ];

    return {
      sourceKind: "live",
      availabilityMessage: null,
      schemaAvailable: true,
      releaseCrudEnabled: true,
      packageCrudEnabled: true,
      rolloutCrudEnabled: true,
      overviewStats: liveOverviewStats,
      releaseRows: liveReleaseRows,
      releaseRecords,
      packageRecords,
      rolloutRecords,
      shopOptions,
      deviceOptions,
      deviceRows: liveDeviceRows,
      rolloutRows: liveRolloutRows,
    };
  } catch {
    return buildUnavailableSoftwareUpdatesData();
  }
}
