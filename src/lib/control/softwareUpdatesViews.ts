import { supabaseAdmin } from "@/lib/supabase/admin";
import { formatDateTime } from "@/lib/ui/dates";
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
  required: string;
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
  release_notes: string;
  minimum_supported_version: string;
  rollback_version: string;
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

export type SoftwareUpdatesWorkspaceData = {
  sourceKind: "demo" | "mixed" | "live";
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
  release_notes: string | null;
  minimum_supported_version: string | null;
  rollback_version: string | null;
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

function isMissingRelationError(message: string) {
  const text = String(message ?? "").toLowerCase();
  return text.includes("does not exist") || text.includes("could not find the table") || text.includes("schema cache");
}

export function buildDemoSoftwareUpdatesData(): SoftwareUpdatesWorkspaceData {
  return {
    sourceKind: "demo",
    schemaAvailable: false,
    releaseCrudEnabled: false,
    packageCrudEnabled: false,
    rolloutCrudEnabled: false,
    overviewStats: [
      { label: "Latest Desktop Version", value: "1.4.2", meta: "Stable channel package currently surfaced in local demo data.", tone: "success" },
      { label: "Latest Service Version", value: "1.4.2", meta: "Control-only release metadata placeholder for future service rollout approval.", tone: "success" },
      { label: "Latest Workstation Version", value: "1.4.2", meta: "Demo release visibility only. No local install behavior is wired.", tone: "success" },
      { label: "Mobile Minimum Version", value: "1.2.0", meta: "Control tracks current/minimum supported store versions, not app-store installs.", tone: "info" },
      { label: "Devices Current", value: "42", meta: "Sample count from local demo data until device update status is backed by the database.", tone: "success" },
      { label: "Devices Pending Update", value: "9", meta: "Devices behind an approved release in this Phase 1 mock workspace.", tone: "warning" },
      { label: "Failed Installs", value: "2", meta: "Placeholder operational visibility for future service-reported update outcomes.", tone: "danger" },
      { label: "Blocked Devices", value: "3", meta: "Demo count for devices that cannot proceed because policy or version state is blocked.", tone: "danger" },
    ],
    releaseRows: [
      { app: "Desktop", version: "1.4.2", channel: "stable", status: "active", required: "optional", released: "2026-05-18 09:10 ET", packageName: "RunBook.Desktop-1.4.2.zip" },
      { app: "Service", version: "1.4.2", channel: "stable", status: "active", required: "optional", released: "2026-05-18 09:10 ET", packageName: "RunBook.Service-1.4.2.zip" },
      { app: "Workstation", version: "1.4.2", channel: "stable", status: "active", required: "optional", released: "2026-05-18 09:10 ET", packageName: "RunBook.Workstation-1.4.2.zip" },
      { app: "Mobile", version: "1.2.0", channel: "stable", status: "minimum supported", required: "minimum", released: "2026-05-12 08:30 ET", packageName: "App store tracked" },
    ],
    releaseRecords: [],
    packageRecords: [],
    rolloutRecords: [],
    shopOptions: [],
    deviceOptions: [],
    deviceRows: [
      { device: "RB-WS-014", shop: "Ten MFG East", desktop: "1.4.2", service: "1.4.2", workstation: "1.4.2", mobile: "1.2.0", channel: "stable", status: "current", lastCheck: "2026-05-21 08:04 ET", lastError: "None reported" },
      { device: "RB-WS-019", shop: "Ten MFG East", desktop: "1.4.1", service: "1.4.2", workstation: "1.4.1", mobile: "1.2.0", channel: "stable", status: "pending update", lastCheck: "2026-05-21 07:42 ET", lastError: "None reported" },
      { device: "RB-SVC-003", shop: "North River Fab", desktop: "n/a", service: "1.4.0", workstation: "n/a", mobile: "n/a", channel: "stable", status: "required update", lastCheck: "2026-05-21 07:15 ET", lastError: "None reported" },
      { device: "RB-MOB-221", shop: "North River Fab", desktop: "n/a", service: "n/a", workstation: "n/a", mobile: "1.1.8", channel: "stable", status: "blocked", lastCheck: "2026-05-20 18:11 ET", lastError: "Store minimum version policy not met" },
      { device: "RB-WS-030", shop: "Summit Tool", desktop: "1.4.2", service: "1.4.2", workstation: "1.4.2", mobile: "1.2.0", channel: "stable", status: "failed", lastCheck: "2026-05-21 06:58 ET", lastError: "Installer exited before completion" },
    ],
    rolloutRows: [
      { release: "Desktop 1.4.2", target: "Pilot shops", channel: "stable", required: "optional", status: "approved", starts: "2026-05-22 21:00 ET", progress: "6/12 devices current" },
      { release: "Service 1.4.2", target: "All enrolled services", channel: "stable", required: "required", status: "awaiting start", starts: "2026-05-24 02:00 ET", progress: "0/18 started" },
      { release: "Workstation 1.4.2", target: "East region", channel: "stable", required: "optional", status: "in review", starts: "Not scheduled", progress: "Approval pending" },
      { release: "Mobile 1.2.0", target: "All mobile users", channel: "stable", required: "minimum", status: "published policy", starts: "2026-05-12 08:30 ET", progress: "Store version floor only" },
    ],
  };
}

function sourceKindForSections(sections: boolean[]) {
  const populated = sections.filter(Boolean).length;
  if (populated === 0) return "live" as const;
  if (populated === sections.length) return "live" as const;
  return "mixed" as const;
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
  return rows.find((row) => asText(row.app_name).toLowerCase() === appName && asText(row.status).toLowerCase() === "active")
    ?? rows.find((row) => asText(row.app_name).toLowerCase() === appName)
    ?? null;
}

export async function loadSoftwareUpdatesWorkspaceData(): Promise<SoftwareUpdatesWorkspaceData> {
  const demo = buildDemoSoftwareUpdatesData();

  try {
    const admin = supabaseAdmin();
    const [releasesResult, packagesResult, deviceStatusesResult, rolloutsResult] = await Promise.all([
      admin
        .from("rb_software_releases")
        .select("id,app_name,version,channel,status,required,release_notes,minimum_supported_version,rollback_version,published_at,created_at,updated_at")
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
      return demo;
    }
    if (allErrors.length > 0) {
      return demo;
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
          release_notes: asText(row.release_notes),
          minimum_supported_version: asText(row.minimum_supported_version),
          rollback_version: asText(row.rollback_version),
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
      required: row.required ? "required" : (asText(row.app_name).toLowerCase() === "mobile" && asText(row.minimum_supported_version) ? "minimum" : "optional"),
      released: formatMaybeDateTime(row.published_at || row.created_at, "Not published"),
      packageName: (() => {
        const releaseId = asText(row.id);
        const count = packageCounts.get(releaseId) ?? 0;
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

    const populatedReleases = liveReleaseRows.length > 0;
    const populatedDevices = liveDeviceRows.length > 0;
    const populatedRollouts = liveRolloutRows.length > 0;
    const sourceKind = sourceKindForSections([populatedReleases, populatedDevices, populatedRollouts]);

    return {
      sourceKind,
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
    return demo;
  }
}
