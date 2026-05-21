import React from "react";
import SoftwareUpdatesWorkspace, { type SoftwareReleaseEditorView } from "@/components/software-updates/SoftwareUpdatesWorkspace";
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
  release_notes?: string;
  minimum_supported_version?: string;
  rollback_version?: string;
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
      release_notes: asText(searchParams?.release_notes) || existing?.release_notes || "",
      minimum_supported_version: asText(searchParams?.minimum_supported_version) || existing?.minimum_supported_version || "",
      rollback_version: asText(searchParams?.rollback_version) || existing?.rollback_version || "",
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
  return <SoftwareUpdatesWorkspace activeTab={readTab(searchParams)} data={data} releaseEditor={releaseEditor} />;
}
