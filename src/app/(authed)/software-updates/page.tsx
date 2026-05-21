import React from "react";
import SoftwareUpdatesWorkspace from "@/components/software-updates/SoftwareUpdatesWorkspace";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = {
  tab?: string;
};

const allowedTabs = new Set(["overview", "releases", "devices", "rollouts", "upload-package", "settings"]);

function readTab(searchParams: SearchParams | undefined) {
  const raw = String(searchParams?.tab ?? "overview").trim().toLowerCase();
  if (allowedTabs.has(raw)) {
    return raw as "overview" | "releases" | "devices" | "rollouts" | "upload-package" | "settings";
  }
  return "overview";
}

export default function SoftwareUpdatesPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  return <SoftwareUpdatesWorkspace activeTab={readTab(searchParams)} />;
}
