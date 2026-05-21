import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";
import { hashToken } from "@/lib/device/tokens";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const allowedChannels = new Set(["dev", "beta", "stable"]);

type CheckBody = {
  deviceId: string;
  shopId: string;
  deviceName: string | null;
  desktopVersion: string | null;
  serviceVersion: string | null;
  workstationVersion: string | null;
  mobileVersion: string | null;
  channel: string;
};

type ReleaseRow = {
  id: string | null;
  app_name: string | null;
  version: string | null;
  channel: string | null;
  required: boolean | null;
  release_notes: string | null;
  minimum_supported_version: string | null;
  rollback_version: string | null;
};

type PackageRow = {
  id: string | null;
  release_id: string | null;
  file_name: string | null;
  download_url: string | null;
  storage_path: string | null;
  sha256: string | null;
  size_bytes: number | null;
  platform: string | null;
  architecture: string | null;
};

type RolloutRow = {
  id: string | null;
  release_id: string | null;
  target_type: string | null;
  target_shop_id: string | null;
  target_device_id: string | null;
  channel: string | null;
  required: boolean | null;
  status: string | null;
  starts_at: string | null;
};

function rbAssertUuid(label: string, value: string) {
  const ok = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  if (!ok) throw new Error(`${label} must be a UUID. Got: ${value}`);
}

function getBearerToken(req: Request): string | null {
  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() ?? null;
}

function asText(value: unknown) {
  return String(value ?? "").trim();
}

function asOptionalText(value: unknown, maxLength?: number) {
  const text = asText(value);
  if (!text) return null;
  if (maxLength && text.length > maxLength) {
    throw new Error(`Value exceeds maximum length of ${maxLength} characters.`);
  }
  return text;
}

async function readJsonBody(req: Request): Promise<Record<string, unknown>> {
  try {
    return await req.json();
  } catch {
    throw new Error("__INVALID_JSON__");
  }
}

function readBody(body: Record<string, unknown>): CheckBody {
  return {
    deviceId: asText(body.deviceId),
    shopId: asText(body.shopId),
    deviceName: asOptionalText(body.deviceName, 160),
    desktopVersion: asOptionalText(body.desktopVersion, 64),
    serviceVersion: asOptionalText(body.serviceVersion, 64),
    workstationVersion: asOptionalText(body.workstationVersion, 64),
    mobileVersion: asOptionalText(body.mobileVersion, 64),
    channel: asText(body.channel).toLowerCase(),
  };
}

function currentVersionForApp(fields: CheckBody, appName: string) {
  if (appName === "desktop") return fields.desktopVersion;
  if (appName === "service") return fields.serviceVersion;
  if (appName === "workstation") return fields.workstationVersion;
  if (appName === "mobile") return fields.mobileVersion;
  return null;
}

function rolloutMatches(rollout: RolloutRow, args: { deviceId: string; shopId: string; channel: string; now: number }) {
  if (asText(rollout.status).toLowerCase() !== "active") return false;
  if (asText(rollout.channel).toLowerCase() !== args.channel) return false;

  const startsAt = asText(rollout.starts_at);
  if (startsAt) {
    const parsed = Date.parse(startsAt);
    if (Number.isFinite(parsed) && parsed > args.now) return false;
  }

  const targetType = asText(rollout.target_type).toLowerCase();
  if (targetType === "all") return true;
  if (targetType === "shop") return asText(rollout.target_shop_id) === args.shopId;
  if (targetType === "device") return asText(rollout.target_device_id) === args.deviceId;
  if (targetType === "beta") return args.channel === "beta";
  return false;
}

function summarizeCheck(args: { updateCount: number; requiredCount: number; channel: string }) {
  return `channel=${args.channel}; updates=${args.updateCount}; required=${args.requiredCount}`;
}

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    rateLimitOrThrow({ key: `software-check:ip:${ip}`, limit: 600, windowMs: 60_000 });

    const rawToken = getBearerToken(req);
    if (!rawToken) {
      return NextResponse.json({ ok: false, error: "Missing Authorization: Bearer <token>" }, { status: 401 });
    }

    const fields = readBody(await readJsonBody(req));

    if (!fields.deviceId) return NextResponse.json({ ok: false, error: "deviceId is required." }, { status: 400 });
    if (!fields.shopId) return NextResponse.json({ ok: false, error: "shopId is required." }, { status: 400 });
    rbAssertUuid("deviceId", fields.deviceId);
    rbAssertUuid("shopId", fields.shopId);

    if (!allowedChannels.has(fields.channel)) {
      return NextResponse.json({ ok: false, error: "channel must be dev, beta, or stable." }, { status: 400 });
    }

    const admin = supabaseAdmin();
    const tokenHash = hashToken(rawToken);

    const { data: tokenRow, error: tokenError } = await admin
      .from("rb_device_tokens")
      .select("id,device_id,revoked_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (tokenError) return NextResponse.json({ ok: false, error: tokenError.message }, { status: 500 });
    if (!tokenRow) return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 401 });
    if (tokenRow.revoked_at) return NextResponse.json({ ok: false, error: "Token revoked" }, { status: 403 });

    rbAssertUuid("token.device_id", String(tokenRow.device_id));
    if (String(tokenRow.device_id) !== fields.deviceId) {
      return NextResponse.json({ ok: false, error: "Token does not match deviceId." }, { status: 403 });
    }

    rateLimitOrThrow({ key: `software-check:device:${fields.deviceId}`, limit: 600, windowMs: 60_000 });

    const { data: deviceRow, error: deviceError } = await admin
      .from("rb_devices")
      .select("id,shop_id,status,name")
      .eq("id", fields.deviceId)
      .maybeSingle();

    if (deviceError) return NextResponse.json({ ok: false, error: deviceError.message }, { status: 500 });
    if (!deviceRow?.id) return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 401 });

    rbAssertUuid("device.shop_id", String(deviceRow.shop_id));
    if (String(deviceRow.shop_id) !== fields.shopId) {
      return NextResponse.json({ ok: false, error: "shopId does not match the authorized device." }, { status: 403 });
    }
    if (String(deviceRow.status ?? "").toLowerCase() !== "active") {
      return NextResponse.json({ ok: false, error: "Device inactive" }, { status: 403 });
    }

    const [releasesResult, packagesResult, rolloutsResult] = await Promise.all([
      admin
        .from("rb_software_releases")
        .select("id,app_name,version,channel,required,release_notes,minimum_supported_version,rollback_version")
        .eq("status", "active")
        .eq("channel", fields.channel),
      admin
        .from("rb_software_packages")
        .select("id,release_id,file_name,download_url,storage_path,sha256,size_bytes,platform,architecture"),
      admin
        .from("rb_software_rollouts")
        .select("id,release_id,target_type,target_shop_id,target_device_id,channel,required,status,starts_at")
        .eq("status", "active")
        .eq("channel", fields.channel),
    ]);

    if (releasesResult.error) return NextResponse.json({ ok: false, error: releasesResult.error.message }, { status: 500 });
    if (packagesResult.error) return NextResponse.json({ ok: false, error: packagesResult.error.message }, { status: 500 });
    if (rolloutsResult.error) return NextResponse.json({ ok: false, error: rolloutsResult.error.message }, { status: 500 });

    const releases = (Array.isArray(releasesResult.data) ? releasesResult.data : []) as ReleaseRow[];
    const packages = (Array.isArray(packagesResult.data) ? packagesResult.data : []) as PackageRow[];
    const rollouts = (Array.isArray(rolloutsResult.data) ? rolloutsResult.data : []) as RolloutRow[];

    const packageByReleaseId = new Map<string, PackageRow>();
    for (const row of packages) {
      const releaseId = asText(row.release_id);
      if (!releaseId || packageByReleaseId.has(releaseId)) continue;
      packageByReleaseId.set(releaseId, row);
    }

    const now = Date.now();
    const matchingRolloutByReleaseId = new Map<string, RolloutRow>();
    for (const rollout of rollouts) {
      const releaseId = asText(rollout.release_id);
      if (!releaseId) continue;
      if (!rolloutMatches(rollout, { deviceId: fields.deviceId, shopId: fields.shopId, channel: fields.channel, now })) continue;
      if (!matchingRolloutByReleaseId.has(releaseId)) {
        matchingRolloutByReleaseId.set(releaseId, rollout);
      }
    }

    const updates = releases
      .map((release) => {
        const releaseId = asText(release.id);
        const appName = asText(release.app_name).toLowerCase();
        const version = asText(release.version);
        if (!releaseId || !appName || !version || appName === "control") return null;

        const pkg = packageByReleaseId.get(releaseId);
        const rollout = matchingRolloutByReleaseId.get(releaseId);
        if (!pkg || !rollout) return null;

        const currentVersion = currentVersionForApp(fields, appName);
        if (currentVersion && currentVersion === version) return null;

        // TODO: Replace this simple equality check with strict semver comparison before any forced-update behavior ships.
        return {
          releaseId,
          appName,
          version,
          channel: asText(release.channel) || fields.channel,
          required: !!(release.required || rollout.required),
          releaseNotes: asText(release.release_notes) || null,
          minimumSupportedVersion: asText(release.minimum_supported_version) || null,
          rollbackVersion: asText(release.rollback_version) || null,
          package: {
            packageId: asText(pkg.id),
            fileName: asText(pkg.file_name),
            downloadUrl: asText(pkg.download_url) || null,
            storagePath: asText(pkg.storage_path) || null,
            sha256: asText(pkg.sha256),
            sizeBytes: pkg.size_bytes ?? null,
            platform: asText(pkg.platform) || "windows",
            architecture: asText(pkg.architecture) || "x64",
          },
          rollout: {
            rolloutId: asText(rollout.id),
            targetType: asText(rollout.target_type) || "all",
            required: !!rollout.required,
          },
        };
      })
      .filter((row): row is NonNullable<typeof row> => !!row);

    const requiredCount = updates.filter((row) => row.required).length;
    const updateStatus = requiredCount > 0 ? "required" : updates.length > 0 ? "available" : "current";
    const checkedAt = new Date().toISOString();
    const summary = summarizeCheck({ updateCount: updates.length, requiredCount, channel: fields.channel });

    const { error: statusError } = await admin
      .from("rb_device_software_status")
      .upsert({
        device_id: fields.deviceId,
        shop_id: fields.shopId,
        device_name: fields.deviceName ?? asOptionalText(deviceRow.name, 160),
        desktop_version: fields.desktopVersion,
        service_version: fields.serviceVersion,
        workstation_version: fields.workstationVersion,
        mobile_version: fields.mobileVersion,
        channel: fields.channel,
        update_status: updateStatus,
        pending_release_id: updates[0]?.releaseId ?? null,
        last_check_at: checkedAt,
        last_error: null,
      }, { onConflict: "device_id" });

    if (statusError) return NextResponse.json({ ok: false, error: statusError.message }, { status: 500 });

    const { error: eventError } = await admin
      .from("rb_software_update_events")
      .insert({
        shop_id: fields.shopId,
        device_id: fields.deviceId,
        app_name: "control",
        event_type: "checked",
        message: summary,
      });

    if (eventError) return NextResponse.json({ ok: false, error: eventError.message }, { status: 500 });

    await admin.from("rb_device_tokens").update({ last_seen_at: checkedAt }).eq("id", tokenRow.id);
    await admin.from("rb_devices").update({ last_seen_at: checkedAt }).eq("id", fields.deviceId);

    return NextResponse.json({
      ok: true,
      deviceId: fields.deviceId,
      shopId: fields.shopId,
      channel: fields.channel,
      updatesAvailable: updates.length > 0,
      updates,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    if (message === "__INVALID_JSON__") {
      return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
    }

    const status =
      /missing authorization/i.test(message) ? 401 :
      /must be a uuid/i.test(message) ? 400 :
      /maximum length/i.test(message) ? 400 :
      500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
