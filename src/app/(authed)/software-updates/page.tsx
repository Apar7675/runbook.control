import React from "react";
import SoftwareUpdatesWorkspace, { type SoftwarePackageEditorView, type SoftwareReleaseEditorView, type SoftwareRolloutEditorView } from "@/components/software-updates/SoftwareUpdatesWorkspace";
import { loadSoftwareUpdatesWorkspaceData, type SoftwareReleaseRecord } from "@/lib/control/softwareUpdatesViews";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = {
  tab?: string;
  mode?: string;
  flash?: string;
  error?: string;
  release_id?: string;
  app_name?: string;
  version?: string;
  channel?: string;
  status?: string;
  required?: string;
  release_intent?: string;
  release_notes?: string;
  minimum_supported_version?: string;
  rollback_version?: string;
  release_package_url?: string;
  release_package_file_name?: string;
  release_package_sha256?: string;
  release_package_size_bytes?: string;
  package_mode?: string;
  selected_release_id?: string;
  package_flash?: string;
  package_error?: string;
  package_id?: string;
  package_release_id?: string;
  package_file_name?: string;
  package_storage_path?: string;
  package_download_url?: string;
  package_sha256?: string;
  package_size_bytes?: string;
  package_platform?: string;
  package_architecture?: string;
  rollout_mode?: string;
  rollout_flash?: string;
  rollout_error?: string;
  rollout_id?: string;
  rollout_release_id?: string;
  rollout_target_type?: string;
  rollout_target_shop_id?: string;
  rollout_target_device_id?: string;
  rollout_channel?: string;
  rollout_required?: string;
  rollout_status?: string;
  rollout_starts_at?: string;
};

const allowedTabs = new Set(["overview", "releases", "devices", "rollouts", "upload-package", "settings"]);

function readTab(searchParams: SearchParams | undefined) {
  const raw = String(searchParams?.tab ?? "overview").trim().toLowerCase();
  if (allowedTabs.has(raw)) {
    return raw as "overview" | "releases" | "devices" | "rollouts" | "upload-package" | "settings";
  }
  return "overview";
}

function asText(value: string | undefined) {
  return String(value ?? "").trim();
}

function toDateTimeLocalValue(value: string | undefined) {
  const text = asText(value);
  if (!text) return "";
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  const hours = String(parsed.getHours()).padStart(2, "0");
  const minutes = String(parsed.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function buildReleaseEditor(searchParams: SearchParams | undefined, releaseRecords: SoftwareReleaseRecord[]) {
  const modeRaw = asText(searchParams?.mode).toLowerCase();
  const mode: SoftwareReleaseEditorView["mode"] = modeRaw === "new" || modeRaw === "edit" ? modeRaw : null;
  const releaseId = asText(searchParams?.release_id);
  const existing = releaseId ? releaseRecords.find((row) => row.id === releaseId) ?? null : null;

  return {
    mode,
    flash: asText(searchParams?.flash),
    error: asText(searchParams?.error),
    values: {
      release_id: releaseId || existing?.id || "",
      app_name: asText(searchParams?.app_name) || existing?.app_name || "desktop",
      version: asText(searchParams?.version) || existing?.version || "",
      channel: asText(searchParams?.channel) || existing?.channel || "stable",
      status: asText(searchParams?.status) || existing?.status || "draft",
      required: asText(searchParams?.required).toLowerCase() === "true" || (!!existing?.required && !asText(searchParams?.required)),
      release_intent: asText(searchParams?.release_intent) || existing?.release_intent || (existing?.required ? "required" : "optional"),
      release_notes: asText(searchParams?.release_notes) || existing?.release_notes || "",
      minimum_supported_version: asText(searchParams?.minimum_supported_version) || existing?.minimum_supported_version || "",
      rollback_version: asText(searchParams?.rollback_version) || existing?.rollback_version || "",
      package_url: asText(searchParams?.release_package_url) || existing?.package_url || "",
      package_file_name: asText(searchParams?.release_package_file_name) || existing?.package_file_name || "",
      package_sha256: asText(searchParams?.release_package_sha256) || existing?.package_sha256 || "",
      package_size_bytes: asText(searchParams?.release_package_size_bytes) || existing?.package_size_bytes || "",
    },
  };
}

function buildPackageEditor(searchParams: SearchParams | undefined, data: Awaited<ReturnType<typeof loadSoftwareUpdatesWorkspaceData>>) {
  const modeRaw = asText(searchParams?.package_mode).toLowerCase();
  const mode: SoftwarePackageEditorView["mode"] = modeRaw === "new" || modeRaw === "edit" ? modeRaw : null;
  const packageId = asText(searchParams?.package_id);
  const selectedReleaseId = asText(searchParams?.selected_release_id) || asText(searchParams?.package_release_id) || data.releaseRecords[0]?.id || "";
  const existing = packageId ? data.packageRecords.find((row) => row.id === packageId) ?? null : null;

  return {
    mode,
    selectedReleaseId,
    flash: asText(searchParams?.package_flash),
    error: asText(searchParams?.package_error),
    values: {
      package_id: packageId || existing?.id || "",
      release_id: asText(searchParams?.package_release_id) || existing?.release_id || selectedReleaseId,
      file_name: asText(searchParams?.package_file_name) || existing?.file_name || "",
      storage_path: asText(searchParams?.package_storage_path) || existing?.storage_path || "",
      download_url: asText(searchParams?.package_download_url) || existing?.download_url || "",
      sha256: asText(searchParams?.package_sha256) || existing?.sha256 || "",
      size_bytes: asText(searchParams?.package_size_bytes) || existing?.size_bytes || "",
      platform: asText(searchParams?.package_platform) || existing?.platform || "windows",
      architecture: asText(searchParams?.package_architecture) || existing?.architecture || "x64",
    },
  };
}

function buildRolloutEditor(searchParams: SearchParams | undefined, data: Awaited<ReturnType<typeof loadSoftwareUpdatesWorkspaceData>>) {
  const modeRaw = asText(searchParams?.rollout_mode).toLowerCase();
  const mode: SoftwareRolloutEditorView["mode"] = modeRaw === "new" || modeRaw === "edit" ? modeRaw : null;
  const rolloutId = asText(searchParams?.rollout_id);
  const existing = rolloutId ? data.rolloutRecords.find((row) => row.id === rolloutId) ?? null : null;

  return {
    mode,
    flash: asText(searchParams?.rollout_flash),
    error: asText(searchParams?.rollout_error),
    values: {
      rollout_id: rolloutId || existing?.id || "",
      release_id: asText(searchParams?.rollout_release_id) || existing?.release_id || data.releaseRecords[0]?.id || "",
      target_type: asText(searchParams?.rollout_target_type) || existing?.target_type || "all",
      target_shop_id: asText(searchParams?.rollout_target_shop_id) || existing?.target_shop_id || "",
      target_device_id: asText(searchParams?.rollout_target_device_id) || existing?.target_device_id || "",
      channel: asText(searchParams?.rollout_channel) || existing?.channel || "stable",
      required: asText(searchParams?.rollout_required).toLowerCase() === "true" || (!!existing?.required && !asText(searchParams?.rollout_required)),
      status: asText(searchParams?.rollout_status) || existing?.status || "planned",
      starts_at: toDateTimeLocalValue(asText(searchParams?.rollout_starts_at) || existing?.starts_at || ""),
    },
  };
}

export default async function SoftwareUpdatesPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const data = await loadSoftwareUpdatesWorkspaceData();
  const releaseEditor = buildReleaseEditor(searchParams, data.releaseRecords);
  const packageEditor = buildPackageEditor(searchParams, data);
  const rolloutEditor = buildRolloutEditor(searchParams, data);
  return <SoftwareUpdatesWorkspace activeTab={readTab(searchParams)} data={data} releaseEditor={releaseEditor} packageEditor={packageEditor} rolloutEditor={rolloutEditor} />;
}
