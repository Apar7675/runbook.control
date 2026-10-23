// Availability is metadata only. This policy never downloads or installs software.
export type SoftwareUpdatePackage = {
  id: string | null; release_id: string | null; file_name: string | null;
  download_url: string | null; storage_path: string | null; sha256: string | null;
  size_bytes: number | null; platform: string | null; architecture: string | null;
};
export type SoftwareUpdateRelease = {
  id: string | null; app_name: string | null; version: string | null; channel: string | null;
  required: boolean | null; release_notes: string | null;
  minimum_supported_version: string | null; rollback_version: string | null;
};
export type SoftwareUpdateRollout = {
  id: string | null; release_id: string | null; target_type: string | null;
  target_shop_id: string | null; target_device_id: string | null; channel: string | null;
  required: boolean | null; status: string | null; starts_at: string | null;
};
type Version = { core: number[]; prerelease: string[] };
const text = (value: unknown) => String(value ?? "").trim();
const apps = new Set(["desktop", "service", "workstation", "mobile", "control"]);
const channels = new Set(["dev", "beta", "stable"]);

export function parseSoftwareVersion(value: unknown): Version | null {
  const version = text(value);
  if (version.length > 64) return null;
  // .NET ProductVersion/AssemblyInformationalVersion can have a fourth numeric
  // component. Treat an omitted revision as zero; build metadata has no precedence.
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:\.(0|[1-9]\d*))?(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/.exec(version);
  if (!match) return null;
  const core = match.slice(1, 5).map((part) => Number(part ?? 0));
  if (core.some((part) => !Number.isSafeInteger(part))) return null;
  const prerelease = match[5]?.split(".") ?? [];
  if (prerelease.some((part) => /^\d+$/.test(part) && part.length > 1 && part.startsWith("0"))) return null;
  return { core, prerelease };
}

export function compareSoftwareVersions(left: unknown, right: unknown): number | null {
  const a = parseSoftwareVersion(left), b = parseSoftwareVersion(right);
  if (!a || !b) return null;
  for (let index = 0; index < 4; index++) {
    if (a.core[index] !== b.core[index]) return a.core[index] > b.core[index] ? 1 : -1;
  }
  if (a.prerelease.length === 0 || b.prerelease.length === 0)
    return a.prerelease.length === b.prerelease.length ? 0 : a.prerelease.length === 0 ? 1 : -1;
  for (let index = 0; index < Math.max(a.prerelease.length, b.prerelease.length); index++) {
    const x = a.prerelease[index], y = b.prerelease[index];
    if (x === undefined || y === undefined) return x === y ? 0 : x === undefined ? -1 : 1;
    if (x === y) continue;
    const numericX = /^\d+$/.test(x), numericY = /^\d+$/.test(y);
    if (numericX && numericY) return x.length !== y.length ? (x.length > y.length ? 1 : -1) : x > y ? 1 : -1;
    if (numericX !== numericY) return numericX ? -1 : 1;
    return x > y ? 1 : -1;
  }
  return 0;
}

export function validSoftwareTarget(platform: string, architecture: string) {
  if (platform === "windows") return ["x64", "arm64", "universal"].includes(architecture);
  if (platform === "ios" || platform === "android") return ["arm64", "universal"].includes(architecture);
  return platform === "web" && ["none", "universal"].includes(architecture);
}

export function softwarePackageMatchesApp(pkg: SoftwareUpdatePackage, appName: string) {
  const platform = text(pkg.platform).toLowerCase();
  return appName === "control" ? platform === "web"
    : appName === "mobile" ? ["ios", "android"].includes(platform)
    : ["desktop", "service", "workstation"].includes(appName) && platform === "windows";
}

export function completeSoftwarePackage(pkg: SoftwareUpdatePackage) {
  return !!text(pkg.id) && !!text(pkg.release_id) && !!text(pkg.file_name) &&
    !!(text(pkg.download_url) || text(pkg.storage_path)) &&
    /^[0-9a-f]{64}$/i.test(text(pkg.sha256)) &&
    Number.isSafeInteger(pkg.size_bytes) && Number(pkg.size_bytes) > 0 &&
    validSoftwareTarget(text(pkg.platform).toLowerCase(), text(pkg.architecture).toLowerCase());
}

export function releaseActivationError(
  release: Pick<SoftwareUpdateRelease, "app_name" | "version" | "channel" | "release_notes" | "minimum_supported_version" | "rollback_version">,
  packages: SoftwareUpdatePackage[],
) {
  const appName = text(release.app_name).toLowerCase();
  if (!apps.has(appName)) return "Choose a valid app.";
  if (!parseSoftwareVersion(release.version)) return "Version must have three or four numeric components with optional prerelease/build labels.";
  if (!channels.has(text(release.channel).toLowerCase())) return "Choose a valid channel.";
  if (!text(release.release_notes)) return "Add release notes before activation.";
  if (text(release.minimum_supported_version)) {
    const comparison = compareSoftwareVersions(release.minimum_supported_version, release.version);
    if (comparison === null || comparison > 0) return "Minimum supported version must be valid and no newer than the release.";
  }
  if (text(release.rollback_version)) {
    const comparison = compareSoftwareVersions(release.rollback_version, release.version);
    if (comparison === null || comparison >= 0) return "Rollback version must be valid and older than the release.";
  }
  if (!packages.some((pkg) => completeSoftwarePackage(pkg) && softwarePackageMatchesApp(pkg, appName)))
    return "Save a draft and add complete package metadata (file, location, SHA256, positive size, platform and architecture) before activation.";
  return "";
}

export function softwareRolloutMatches(
  rollout: SoftwareUpdateRollout,
  args: { deviceId: string; shopId: string; channel: string; now: number },
) {
  if (text(rollout.status).toLowerCase() !== "active" || text(rollout.channel).toLowerCase() !== args.channel) return false;
  const startsAt = text(rollout.starts_at);
  if (startsAt) {
    const parsed = Date.parse(startsAt);
    if (!Number.isFinite(parsed) || parsed > args.now) return false;
  }
  const target = text(rollout.target_type).toLowerCase();
  if (target === "all") return true;
  if (target === "shop") return text(rollout.target_shop_id).toLowerCase() === args.shopId.toLowerCase();
  if (target === "device") return text(rollout.target_device_id).toLowerCase() === args.deviceId.toLowerCase();
  return target === "beta" && args.channel === "beta";
}

export function selectEligibleSoftwareUpdates(args: {
  releases: SoftwareUpdateRelease[]; packages: SoftwareUpdatePackage[]; rollouts: SoftwareUpdateRollout[];
  versions: Record<string, string | null>; deviceId: string; shopId: string; channel: string;
  platform: string; architecture: string; now: number;
}) {
  const selectedApps = new Set<string>();
  const releases = args.releases.filter((row) => parseSoftwareVersion(row.version)).sort((a, b) =>
    (compareSoftwareVersions(b.version, a.version) ?? 0) || text(a.id).localeCompare(text(b.id)));
  return releases.flatMap((release) => {
    const releaseId = text(release.id), appName = text(release.app_name).toLowerCase();
    if (!releaseId || appName === "control" || selectedApps.has(appName) || text(release.channel).toLowerCase() !== args.channel) return [];
    // Missing or unrecognized installed versions cannot authorize an upgrade,
    // a downgrade, a required update, or a claim that this app is current.
    if (compareSoftwareVersions(release.version, args.versions[appName]) !== 1) return [];
    const releasePackages = args.packages.filter((pkg) => text(pkg.release_id) === releaseId);
    if (releaseActivationError(release, releasePackages)) return [];
    const pkg = releasePackages.filter((candidate) =>
      completeSoftwarePackage(candidate) && softwarePackageMatchesApp(candidate, appName) &&
      text(candidate.platform).toLowerCase() === args.platform &&
      [args.architecture, "universal"].includes(text(candidate.architecture).toLowerCase()))
      .sort((a, b) =>
        Number(text(a.architecture).toLowerCase() === "universal") - Number(text(b.architecture).toLowerCase() === "universal") ||
        text(a.id).localeCompare(text(b.id)))[0];
    const matchingRollouts = args.rollouts.filter((row) =>
      text(row.release_id) === releaseId && softwareRolloutMatches(row, args))
      .sort((a, b) => text(a.id).localeCompare(text(b.id)));
    const rollout = matchingRollouts[0];
    if (!pkg || !rollout) return [];
    const rolloutRequired = matchingRollouts.some((row) => !!row.required);
    selectedApps.add(appName);
    return [{
      releaseId, appName, version: text(release.version), channel: args.channel,
      required: !!release.required || rolloutRequired,
      releaseNotes: text(release.release_notes) || null,
      minimumSupportedVersion: text(release.minimum_supported_version) || null,
      rollbackVersion: text(release.rollback_version) || null,
      package: {
        packageId: text(pkg.id), fileName: text(pkg.file_name),
        downloadUrl: text(pkg.download_url) || null, storagePath: text(pkg.storage_path) || null,
        sha256: text(pkg.sha256), sizeBytes: pkg.size_bytes,
        platform: text(pkg.platform).toLowerCase(), architecture: text(pkg.architecture).toLowerCase(),
      },
      rollout: { rolloutId: text(rollout.id), targetType: text(rollout.target_type), required: rolloutRequired },
    }];
  });
}
