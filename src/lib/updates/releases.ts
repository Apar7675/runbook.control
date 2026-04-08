import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { compareVersions, ensureStrictReleaseVersion, isVersionGreater, normalizeVersion } from "@/lib/updates/versions";

export type RunBookAppId = "desktop" | "workstation";
export type RunBookReleaseChannel = "stable" | "beta";
export type RunBookInstallerKind = "installer" | "archive" | "other";

export type RunBookReleaseRow = {
  id: string;
  app_id: RunBookAppId;
  channel: RunBookReleaseChannel;
  version: string;
  min_supported_version: string | null;
  required_update: boolean;
  file_path: string;
  file_name: string | null;
  installer_kind: RunBookInstallerKind;
  notes: string | null;
  sha256: string | null;
  created_by: string;
  created_at: string;
  published_at: string | null;
  is_current: boolean;
};

export type ReleaseManifestStatus = "up_to_date" | "update_available" | "update_required" | "no_release";

export function normalizeAppId(value: string | null | undefined): RunBookAppId {
  return String(value ?? "").trim().toLowerCase() === "workstation" ? "workstation" : "desktop";
}

export function normalizeReleaseChannel(value: string | null | undefined): RunBookReleaseChannel {
  return String(value ?? "").trim().toLowerCase() === "beta" ? "beta" : "stable";
}

export function inferInstallerKind(fileName: string | null | undefined): RunBookInstallerKind {
  const normalized = String(fileName ?? "").trim().toLowerCase();
  if (normalized.endsWith(".zip")) return "archive";
  if (normalized.endsWith(".exe") || normalized.endsWith(".msi") || normalized.endsWith(".msix")) return "installer";
  return "other";
}

function normalizeSha256(value: string | null | undefined) {
  const text = String(value ?? "").trim().toLowerCase().replace(/-/g, "");
  if (!text) return "";
  if (!/^[a-f0-9]{64}$/.test(text)) {
    throw new Error("Release SHA-256 must be a 64-character hexadecimal value.");
  }

  return text;
}

export async function computeStoredPackageSha256(path: string) {
  const normalizedPath = String(path ?? "").trim();
  if (!normalizedPath) {
    throw new Error("Release package path is missing.");
  }

  const admin = supabaseAdmin();
  const { data, error } = await admin.storage.from("rb-updates").download(normalizedPath);
  if (error || !data) {
    throw new Error(error?.message ?? "Could not download the uploaded package to compute SHA-256.");
  }

  const arrayBuffer = await data.arrayBuffer();
  const hash = createHash("sha256");
  hash.update(Buffer.from(arrayBuffer));
  return hash.digest("hex").toLowerCase();
}

export function validateReleaseSafety(release: Pick<RunBookReleaseRow, "version" | "min_supported_version" | "required_update" | "file_path" | "file_name" | "installer_kind" | "sha256">) {
  const version = ensureStrictReleaseVersion(release.version, "Release version");
  const minimumSupportedVersion = ensureStrictReleaseVersion(release.min_supported_version || release.version, "Minimum supported version");
  const inferredInstallerKind = inferInstallerKind(release.file_name || release.file_path);
  const sha256 = normalizeSha256(release.sha256);

  if (release.required_update && inferredInstallerKind !== "installer") {
    throw new Error("Required updates must use an installer package (.exe, .msi, or .msix).");
  }

  if (inferredInstallerKind === "installer" && !sha256) {
    throw new Error("Installer-based releases must have a SHA-256 checksum before they can be published or made current.");
  }

  return {
    version,
    minimumSupportedVersion,
    installerKind: inferredInstallerKind,
    sha256,
  };
}

export async function listReleases(appId?: RunBookAppId, channel?: RunBookReleaseChannel) {
  const admin = supabaseAdmin();
  let query = admin
    .from("rb_update_packages")
    .select("id,app_id,channel,version,min_supported_version,required_update,file_path,file_name,installer_kind,notes,sha256,created_by,created_at,published_at,is_current")
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (appId) query = query.eq("app_id", appId);
  if (channel) query = query.eq("channel", channel);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as RunBookReleaseRow[];
}

export async function getCurrentRelease(appId: RunBookAppId, channel: RunBookReleaseChannel) {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("rb_update_packages")
    .select("id,app_id,channel,version,min_supported_version,required_update,file_path,file_name,installer_kind,notes,sha256,created_by,created_at,published_at,is_current")
    .eq("app_id", appId)
    .eq("channel", channel)
    .eq("is_current", true)
    .not("published_at", "is", null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data ?? null) as RunBookReleaseRow | null;
}

export async function getReleaseById(releaseId: string) {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("rb_update_packages")
    .select("id,app_id,channel,version,min_supported_version,required_update,file_path,file_name,installer_kind,notes,sha256,created_by,created_at,published_at,is_current")
    .eq("id", releaseId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data ?? null) as RunBookReleaseRow | null;
}

export async function publishRelease(packageId: string) {
  const admin = supabaseAdmin();
  const release = await getReleaseById(packageId);
  if (!release) throw new Error("Release package not found.");
  validateReleaseSafety(release);

  const now = new Date().toISOString();

  const { error: clearError } = await admin
    .from("rb_update_packages")
    .update({ is_current: false })
    .eq("app_id", release.app_id)
    .eq("channel", release.channel)
    .eq("is_current", true);

  if (clearError) throw new Error(clearError.message);

  const { error: publishError } = await admin
    .from("rb_update_packages")
    .update({ is_current: true, published_at: now })
    .eq("id", packageId);

  if (publishError) throw new Error(publishError.message);

  return {
    ...release,
    is_current: true,
    published_at: now,
  } satisfies RunBookReleaseRow;
}

export function evaluateReleaseManifest(args: {
  installedVersion: string | null;
  release: RunBookReleaseRow | null;
}) {
  const installedVersion = args.installedVersion ? normalizeVersion(args.installedVersion) : null;
  const release = args.release;

  if (!release) {
    return {
      status: "no_release" as ReleaseManifestStatus,
      latestVersion: null,
      minimumSupportedVersion: null,
      updateAvailable: false,
      updateRequired: false,
    };
  }

  const latestVersion = ensureStrictReleaseVersion(release.version, "Release version");
  const minimumSupportedVersion = ensureStrictReleaseVersion(release.min_supported_version || release.version, "Minimum supported version");
  const newerAvailable = installedVersion ? isVersionGreater(latestVersion, installedVersion) : true;
  const belowMinimum = installedVersion ? compareVersions(installedVersion, minimumSupportedVersion) === -1 : false;
  const updateRequired = Boolean(release.required_update || belowMinimum);
  const status: ReleaseManifestStatus = updateRequired
    ? "update_required"
    : newerAvailable
      ? "update_available"
      : "up_to_date";

  return {
    status,
    latestVersion,
    minimumSupportedVersion,
    updateAvailable: newerAvailable,
    updateRequired,
  };
}
