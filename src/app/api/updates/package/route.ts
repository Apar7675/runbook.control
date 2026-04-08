import { NextResponse } from "next/server";
import { auditLog } from "@/lib/audit";
import { requirePlatformAdminAal2 } from "@/lib/authz";
import {
  computeStoredPackageSha256,
  inferInstallerKind,
  listReleases,
  normalizeAppId,
  normalizeReleaseChannel,
  validateReleaseSafety,
} from "@/lib/updates/releases";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ensureStrictReleaseVersion } from "@/lib/updates/versions";

export async function GET(req: Request) {
  try {
    await requirePlatformAdminAal2();
    const url = new URL(req.url);
    const appId = url.searchParams.get("app");
    const channel = url.searchParams.get("channel");

    const releases = await listReleases(
      appId ? normalizeAppId(appId) : undefined,
      channel ? normalizeReleaseChannel(channel) : undefined
    );

    return NextResponse.json({ ok: true, releases });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    return NextResponse.json(
      { ok: false, error: msg },
      { status: /not authenticated/i.test(msg) ? 401 : /mfa required/i.test(msg) || /not a platform admin/i.test(msg) ? 403 : 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { user } = await requirePlatformAdminAal2();
    const body = await req.json();

    const appId = normalizeAppId(body.app_id);
    const channel = normalizeReleaseChannel(body.channel);
    const version = ensureStrictReleaseVersion(body.version, "Release version");
    const minSupportedVersion = body.min_supported_version == null || String(body.min_supported_version) === ""
      ? version
      : ensureStrictReleaseVersion(body.min_supported_version, "Minimum supported version");
    const notes = body.notes ? String(body.notes) : null;
    const path = String(body.path ?? "").trim();
    const fileName = String(body.file_name ?? "").trim() || path.split("/").pop() || null;
    const requiredUpdate = Boolean(body.required_update);
    const publishNow = Boolean(body.publish_now);
    const installerKind = inferInstallerKind(fileName);

    if (!version || !path) {
      return NextResponse.json({ ok: false, error: "Missing version or installer file path." }, { status: 400 });
    }

    const admin = supabaseAdmin();
    const computedSha256 = await computeStoredPackageSha256(path);
    const validated = validateReleaseSafety({
      version,
      min_supported_version: minSupportedVersion,
      required_update: requiredUpdate,
      file_path: path,
      file_name: fileName,
      installer_kind: installerKind,
      sha256: computedSha256,
    });

    if (publishNow) {
      const { error: clearError } = await admin
        .from("rb_update_packages")
        .update({ is_current: false })
        .eq("app_id", appId)
        .eq("channel", channel)
        .eq("is_current", true);

      if (clearError) return NextResponse.json({ ok: false, error: clearError.message }, { status: 500 });
    }

    const now = new Date().toISOString();
    const { data: row, error } = await admin
      .from("rb_update_packages")
      .insert({
        app_id: appId,
        channel,
        version,
        min_supported_version: minSupportedVersion,
        required_update: requiredUpdate,
        file_path: path,
        file_name: fileName,
        installer_kind: validated.installerKind,
        notes,
        sha256: validated.sha256,
        created_by: user.id,
        published_at: publishNow ? now : null,
        is_current: publishNow,
      })
      .select("id,app_id,channel,version,min_supported_version,required_update,file_path,file_name,installer_kind,notes,sha256,created_by,created_at,published_at,is_current")
      .single();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    await auditLog({
      shop_id: null,
      action: publishNow ? "update.package_published" : "update.package_uploaded",
      entity_type: "update",
      entity_id: row.id,
      details: {
        app_id: appId,
        channel,
        version,
        path,
        publish_now: publishNow,
        required_update: requiredUpdate,
        min_supported_version: minSupportedVersion,
        sha256: validated.sha256,
      },
    });

    return NextResponse.json({ ok: true, release: row }, { status: 200 });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    return NextResponse.json(
      { ok: false, error: msg },
      { status: /not authenticated/i.test(msg) ? 401 : /mfa required/i.test(msg) || /not a platform admin/i.test(msg) ? 403 : 500 }
    );
  }
}
