import { NextResponse } from "next/server";
import { evaluateReleaseManifest, getCurrentRelease, normalizeAppId, normalizeReleaseChannel } from "@/lib/updates/releases";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const appId = normalizeAppId(url.searchParams.get("app"));
    const channel = normalizeReleaseChannel(url.searchParams.get("channel"));
    const currentVersion = String(url.searchParams.get("currentVersion") ?? "").trim() || null;

    const release = await getCurrentRelease(appId, channel);
    const manifest = evaluateReleaseManifest({
      installedVersion: currentVersion,
      release,
    });

    const downloadUrl = release ? new URL(`/api/updates/download/${release.id}`, url).toString() : null;

    return NextResponse.json({
      ok: true,
      app_id: appId,
      channel,
      installed_version: currentVersion,
      latest_version: manifest.latestVersion,
      minimum_supported_version: manifest.minimumSupportedVersion,
      update_available: manifest.updateAvailable,
      update_required: manifest.updateRequired,
      status: manifest.status,
      release_notes: release?.notes ?? null,
      download_url: downloadUrl,
      installer_kind: release?.installer_kind ?? null,
      published_at: release?.published_at ?? null,
      file_name: release?.file_name ?? null,
      sha256: release?.sha256 ?? null,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}
