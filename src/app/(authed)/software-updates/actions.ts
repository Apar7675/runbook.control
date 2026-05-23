"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePlatformAdminAal2 } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabase/admin";

const allowedApps = new Set(["desktop", "service", "workstation", "mobile", "control"]);
const allowedChannels = new Set(["dev", "beta", "stable"]);
const allowedStatuses = new Set(["draft", "active", "retired", "blocked"]);
const allowedReleaseIntents = new Set(["optional", "recommended", "required"]);
const allowedPlatforms = new Set(["windows", "ios", "android", "web"]);
const allowedArchitectures = new Set(["x64", "arm64", "universal", "none"]);
const allowedRolloutTargetTypes = new Set(["all", "shop", "device", "beta"]);
const allowedRolloutStatuses = new Set(["planned", "active", "paused", "completed", "cancelled"]);

type ReleaseEditorFields = {
  release_id?: string;
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
};

type PackageEditorFields = {
  package_id?: string;
  release_id: string;
  file_name: string;
  storage_path: string;
  download_url: string;
  sha256: string;
  size_bytes: string;
  platform: string;
  architecture: string;
};

type RolloutEditorFields = {
  rollout_id?: string;
  release_id: string;
  target_type: string;
  target_shop_id: string;
  target_device_id: string;
  channel: string;
  required: boolean;
  status: string;
  starts_at: string;
};

function asText(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function asOptionalText(value: FormDataEntryValue | null) {
  const text = asText(value);
  return text || "";
}

function asBoolean(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim().toLowerCase();
  return text === "true" || text === "on" || text === "1";
}

function encodeEditorUrl(args: {
  mode?: "new" | "edit";
  flash?: string;
  error?: string;
  fields?: Partial<ReleaseEditorFields>;
}) {
  const params = new URLSearchParams({ tab: "releases" });
  if (args.mode) params.set("mode", args.mode);
  if (args.flash) params.set("flash", args.flash);
  if (args.error) params.set("error", args.error);

  const fields = args.fields ?? {};
  if (fields.release_id) params.set("release_id", fields.release_id);
  if (fields.app_name) params.set("app_name", fields.app_name);
  if (fields.version) params.set("version", fields.version);
  if (fields.channel) params.set("channel", fields.channel);
  if (fields.status) params.set("status", fields.status);
  params.set("required", fields.required ? "true" : "false");
  if (fields.release_intent) params.set("release_intent", fields.release_intent);
  if (fields.release_notes) params.set("release_notes", fields.release_notes);
  if (fields.minimum_supported_version) params.set("minimum_supported_version", fields.minimum_supported_version);
  if (fields.rollback_version) params.set("rollback_version", fields.rollback_version);
  if (fields.package_url) params.set("release_package_url", fields.package_url);
  if (fields.package_file_name) params.set("release_package_file_name", fields.package_file_name);
  if (fields.package_sha256) params.set("release_package_sha256", fields.package_sha256);
  if (fields.package_size_bytes) params.set("release_package_size_bytes", fields.package_size_bytes);

  return `/software-updates?${params.toString()}`;
}

function encodePackageEditorUrl(args: {
  packageMode?: "new" | "edit";
  selectedReleaseId?: string;
  flash?: string;
  error?: string;
  fields?: Partial<PackageEditorFields>;
}) {
  const params = new URLSearchParams({ tab: "releases" });
  if (args.packageMode) params.set("package_mode", args.packageMode);
  if (args.selectedReleaseId) params.set("selected_release_id", args.selectedReleaseId);
  if (args.flash) params.set("package_flash", args.flash);
  if (args.error) params.set("package_error", args.error);

  const fields = args.fields ?? {};
  if (fields.package_id) params.set("package_id", fields.package_id);
  if (fields.release_id) params.set("package_release_id", fields.release_id);
  if (fields.file_name) params.set("package_file_name", fields.file_name);
  if (fields.storage_path) params.set("package_storage_path", fields.storage_path);
  if (fields.download_url) params.set("package_download_url", fields.download_url);
  if (fields.sha256) params.set("package_sha256", fields.sha256);
  if (fields.size_bytes) params.set("package_size_bytes", fields.size_bytes);
  if (fields.platform) params.set("package_platform", fields.platform);
  if (fields.architecture) params.set("package_architecture", fields.architecture);

  return `/software-updates?${params.toString()}`;
}

function encodeRolloutEditorUrl(args: {
  rolloutMode?: "new" | "edit";
  flash?: string;
  error?: string;
  fields?: Partial<RolloutEditorFields>;
}) {
  const params = new URLSearchParams({ tab: "rollouts" });
  if (args.rolloutMode) params.set("rollout_mode", args.rolloutMode);
  if (args.flash) params.set("rollout_flash", args.flash);
  if (args.error) params.set("rollout_error", args.error);

  const fields = args.fields ?? {};
  if (fields.rollout_id) params.set("rollout_id", fields.rollout_id);
  if (fields.release_id) params.set("rollout_release_id", fields.release_id);
  if (fields.target_type) params.set("rollout_target_type", fields.target_type);
  if (fields.target_shop_id) params.set("rollout_target_shop_id", fields.target_shop_id);
  if (fields.target_device_id) params.set("rollout_target_device_id", fields.target_device_id);
  if (fields.channel) params.set("rollout_channel", fields.channel);
  params.set("rollout_required", fields.required ? "true" : "false");
  if (fields.status) params.set("rollout_status", fields.status);
  if (fields.starts_at) params.set("rollout_starts_at", fields.starts_at);

  return `/software-updates?${params.toString()}`;
}

function readReleaseFields(formData: FormData): ReleaseEditorFields {
  const releaseIntent = asText(formData.get("release_intent")).toLowerCase() || "optional";
  const isRequiredIntent = releaseIntent === "required";
  return {
    release_id: asOptionalText(formData.get("release_id")) || undefined,
    app_name: asText(formData.get("app_name")).toLowerCase(),
    version: asText(formData.get("version")),
    channel: asText(formData.get("channel")).toLowerCase(),
    status: asText(formData.get("status")).toLowerCase() || "draft",
    required: isRequiredIntent || asBoolean(formData.get("required")),
    release_intent: releaseIntent,
    release_notes: asOptionalText(formData.get("release_notes")),
    minimum_supported_version: asOptionalText(formData.get("minimum_supported_version")),
    rollback_version: asOptionalText(formData.get("rollback_version")),
    package_url: asOptionalText(formData.get("package_url")),
    package_file_name: asOptionalText(formData.get("package_file_name")),
    package_sha256: asText(formData.get("package_sha256")).toLowerCase(),
    package_size_bytes: asOptionalText(formData.get("package_size_bytes")),
  };
}

function validateReleaseFields(fields: ReleaseEditorFields) {
  if (!allowedApps.has(fields.app_name)) return "Choose a valid app.";
  if (!fields.version) return "Version is required.";
  if (!allowedChannels.has(fields.channel)) return "Choose a valid channel.";
  if (!allowedStatuses.has(fields.status)) return "Choose a valid status.";
  if (!allowedReleaseIntents.has(fields.release_intent)) return "Choose a valid release intent.";
  if (fields.package_sha256 && !/^[0-9a-f]{64}$/i.test(fields.package_sha256)) return "Package SHA256 must be exactly 64 hex characters when provided.";
  if (fields.package_size_bytes) {
    const parsed = Number(fields.package_size_bytes);
    if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
      return "Package size bytes must be a positive whole number when provided.";
    }
  }
  return "";
}

function readPackageFields(formData: FormData): PackageEditorFields {
  return {
    package_id: asOptionalText(formData.get("package_id")) || undefined,
    release_id: asText(formData.get("release_id")),
    file_name: asText(formData.get("file_name")),
    storage_path: asOptionalText(formData.get("storage_path")),
    download_url: asOptionalText(formData.get("download_url")),
    sha256: asText(formData.get("sha256")).toLowerCase(),
    size_bytes: asOptionalText(formData.get("size_bytes")),
    platform: asText(formData.get("platform")).toLowerCase(),
    architecture: asText(formData.get("architecture")).toLowerCase(),
  };
}

function validatePackageFields(fields: PackageEditorFields) {
  if (!fields.release_id) return "Choose a release.";
  if (!fields.file_name) return "File name is required.";
  if (!fields.sha256) return "SHA256 is required.";
  if (!/^[0-9a-f]{64}$/i.test(fields.sha256)) return "SHA256 must be exactly 64 hex characters.";
  if (fields.size_bytes) {
    const parsed = Number(fields.size_bytes);
    if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
      return "Size bytes must be a positive whole number.";
    }
  }
  if (!allowedPlatforms.has(fields.platform)) return "Choose a valid platform.";
  if (!allowedArchitectures.has(fields.architecture)) return "Choose a valid architecture.";
  if (!fields.storage_path && !fields.download_url) return "Provide a storage path or a download URL.";
  return "";
}

function readRolloutFields(formData: FormData): RolloutEditorFields {
  return {
    rollout_id: asOptionalText(formData.get("rollout_id")) || undefined,
    release_id: asText(formData.get("release_id")),
    target_type: asText(formData.get("target_type")).toLowerCase(),
    target_shop_id: asOptionalText(formData.get("target_shop_id")),
    target_device_id: asOptionalText(formData.get("target_device_id")),
    channel: asText(formData.get("channel")).toLowerCase(),
    required: asBoolean(formData.get("required")),
    status: asText(formData.get("status")).toLowerCase(),
    starts_at: asOptionalText(formData.get("starts_at")),
  };
}

function validateRolloutFields(fields: RolloutEditorFields) {
  if (!fields.release_id) return "Choose a release.";
  if (!allowedRolloutTargetTypes.has(fields.target_type)) return "Choose a valid target type.";
  if (!allowedChannels.has(fields.channel)) return "Choose a valid channel.";
  if (!allowedRolloutStatuses.has(fields.status)) return "Choose a valid rollout status.";
  if (fields.target_type === "shop" && !fields.target_shop_id) return "Choose a shop target.";
  if (fields.target_type === "device" && !fields.target_device_id) return "Choose a device target.";
  return "";
}

async function loadReleaseOrThrow(releaseId: string) {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("rb_software_releases")
    .select("id,published_at,package_uploaded_at")
    .eq("id", releaseId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error("Release not found.");
  return data;
}

async function loadPackageOrThrow(packageId: string) {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("rb_software_packages")
    .select("id,release_id")
    .eq("id", packageId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error("Package metadata row not found.");
  return data;
}

async function loadRolloutOrThrow(rolloutId: string) {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("rb_software_rollouts")
    .select("id,release_id")
    .eq("id", rolloutId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error("Rollout not found.");
  return data;
}

async function loadShopOrThrow(shopId: string) {
  const admin = supabaseAdmin();
  const { data, error } = await admin.from("rb_shops").select("id").eq("id", shopId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error("Shop target not found.");
}

async function loadDeviceOrThrow(deviceId: string) {
  const admin = supabaseAdmin();
  const { data, error } = await admin.from("rb_devices").select("id").eq("id", deviceId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error("Device target not found.");
}

function isDuplicateError(message: string, code?: string) {
  const text = String(message ?? "").toLowerCase();
  return code === "23505" || text.includes("duplicate") || text.includes("unique");
}

export async function saveSoftwareReleaseAction(formData: FormData) {
  const { user } = await requirePlatformAdminAal2();
  const fields = readReleaseFields(formData);
  const mode = fields.release_id ? "edit" : "new";
  const validationError = validateReleaseFields(fields);

  if (validationError) {
    redirect(encodeEditorUrl({ mode, error: validationError, fields }));
  }

  const admin = supabaseAdmin();
  const isActivating = fields.status === "active";
  const hasReleasePackageMetadata = !!fields.package_url || !!fields.package_file_name || !!fields.package_sha256 || !!fields.package_size_bytes;

  try {
    if (fields.release_id) {
      const existing = await loadReleaseOrThrow(fields.release_id);
      const payload = {
        app_name: fields.app_name,
        version: fields.version,
        channel: fields.channel,
        status: fields.status,
        required: fields.release_intent === "required" ? true : fields.required,
        release_intent: fields.release_intent,
        release_notes: fields.release_notes || null,
        minimum_supported_version: fields.minimum_supported_version || null,
        rollback_version: fields.rollback_version || null,
        package_url: fields.package_url || null,
        package_file_name: fields.package_file_name || null,
        package_sha256: fields.package_sha256 || null,
        package_size_bytes: fields.package_size_bytes ? Number(fields.package_size_bytes) : null,
        package_uploaded_at: hasReleasePackageMetadata ? (existing.package_uploaded_at ?? new Date().toISOString()) : null,
        approved_by: isActivating ? user.id : null,
        published_at: isActivating ? (existing.published_at ?? new Date().toISOString()) : existing.published_at,
      };

      const { error } = await admin
        .from("rb_software_releases")
        .update(payload)
        .eq("id", fields.release_id);

      if (error) {
        if (isDuplicateError(error.message, error.code)) throw new Error("__DUPLICATE_RELEASE__");
        throw new Error(error.message);
      }
    } else {
      const payload = {
        app_name: fields.app_name,
        version: fields.version,
        channel: fields.channel,
        status: fields.status || "draft",
        required: fields.release_intent === "required" ? true : fields.required,
        release_intent: fields.release_intent,
        release_notes: fields.release_notes || null,
        minimum_supported_version: fields.minimum_supported_version || null,
        rollback_version: fields.rollback_version || null,
        package_url: fields.package_url || null,
        package_file_name: fields.package_file_name || null,
        package_sha256: fields.package_sha256 || null,
        package_size_bytes: fields.package_size_bytes ? Number(fields.package_size_bytes) : null,
        package_uploaded_at: hasReleasePackageMetadata ? new Date().toISOString() : null,
        created_by: user.id,
        approved_by: isActivating ? user.id : null,
        published_at: isActivating ? new Date().toISOString() : null,
      };

      const { error } = await admin.from("rb_software_releases").insert(payload);
      if (error) {
        if (isDuplicateError(error.message, error.code)) throw new Error("__DUPLICATE_RELEASE__");
        throw new Error(error.message);
      }
    }
  } catch (error) {
    const message = error instanceof Error && error.message === "__DUPLICATE_RELEASE__"
      ? "That app, version, and channel combination already exists."
      : error instanceof Error ? error.message : "Release save failed.";
    redirect(encodeEditorUrl({ mode, error: message, fields }));
  }

  revalidatePath("/software-updates");
  redirect(encodeEditorUrl({ flash: fields.release_id ? "Release updated." : "Release created." }));
}

export async function activateSoftwareReleaseAction(formData: FormData) {
  const { user } = await requirePlatformAdminAal2();
  const releaseId = asText(formData.get("release_id"));
  if (!releaseId) redirect(encodeEditorUrl({ error: "Release id is required." }));

  try {
    const existing = await loadReleaseOrThrow(releaseId);
    const admin = supabaseAdmin();
    const { error } = await admin
      .from("rb_software_releases")
      .update({
        status: "active",
        approved_by: user.id,
        published_at: existing.published_at ?? new Date().toISOString(),
      })
      .eq("id", releaseId);

    if (error) throw new Error(error.message);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Release activation failed.";
    redirect(encodeEditorUrl({ error: message }));
  }

  revalidatePath("/software-updates");
  redirect(encodeEditorUrl({ flash: "Release activated." }));
}

export async function retireSoftwareReleaseAction(formData: FormData) {
  await requirePlatformAdminAal2();
  const releaseId = asText(formData.get("release_id"));
  if (!releaseId) redirect(encodeEditorUrl({ error: "Release id is required." }));

  try {
    await loadReleaseOrThrow(releaseId);
    const admin = supabaseAdmin();
    const { error } = await admin
      .from("rb_software_releases")
      .update({ status: "retired" })
      .eq("id", releaseId);

    if (error) throw new Error(error.message);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Release retire failed.";
    redirect(encodeEditorUrl({ error: message }));
  }

  revalidatePath("/software-updates");
  redirect(encodeEditorUrl({ flash: "Release retired." }));
}

export async function saveSoftwarePackageAction(formData: FormData) {
  await requirePlatformAdminAal2();
  const fields = readPackageFields(formData);
  const packageMode = fields.package_id ? "edit" : "new";
  const validationError = validatePackageFields(fields);

  if (validationError) {
    redirect(encodePackageEditorUrl({ packageMode, selectedReleaseId: fields.release_id, error: validationError, fields }));
  }

  try {
    await loadReleaseOrThrow(fields.release_id);
    const admin = supabaseAdmin();

    const payload = {
      release_id: fields.release_id,
      file_name: fields.file_name,
      storage_path: fields.storage_path || null,
      download_url: fields.download_url || null,
      sha256: fields.sha256,
      size_bytes: fields.size_bytes ? Number(fields.size_bytes) : null,
      platform: fields.platform,
      architecture: fields.architecture,
    };

    if (fields.package_id) {
      await loadPackageOrThrow(fields.package_id);
      const { error } = await admin.from("rb_software_packages").update(payload).eq("id", fields.package_id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await admin.from("rb_software_packages").insert(payload);
      if (error) throw new Error(error.message);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Package metadata save failed.";
    redirect(encodePackageEditorUrl({ packageMode, selectedReleaseId: fields.release_id, error: message, fields }));
  }

  revalidatePath("/software-updates");
  redirect(encodePackageEditorUrl({ selectedReleaseId: fields.release_id, flash: fields.package_id ? "Package metadata updated." : "Package metadata added." }));
}

export async function removeSoftwarePackageAction(formData: FormData) {
  await requirePlatformAdminAal2();
  const packageId = asText(formData.get("package_id"));
  const selectedReleaseId = asText(formData.get("release_id"));
  if (!packageId) redirect(encodePackageEditorUrl({ selectedReleaseId, error: "Package id is required." }));

  try {
    await loadPackageOrThrow(packageId);
    const admin = supabaseAdmin();
    const { error } = await admin.from("rb_software_packages").delete().eq("id", packageId);
    if (error) throw new Error(error.message);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Package metadata removal failed.";
    redirect(encodePackageEditorUrl({ selectedReleaseId, error: message }));
  }

  revalidatePath("/software-updates");
  redirect(encodePackageEditorUrl({ selectedReleaseId, flash: "Package metadata removed." }));
}

export async function saveSoftwareRolloutAction(formData: FormData) {
  await requirePlatformAdminAal2();
  const fields = readRolloutFields(formData);
  const rolloutMode = fields.rollout_id ? "edit" : "new";
  const validationError = validateRolloutFields(fields);

  if (validationError) {
    redirect(encodeRolloutEditorUrl({ rolloutMode, error: validationError, fields }));
  }

  try {
    await loadReleaseOrThrow(fields.release_id);
    if (fields.target_type === "shop") await loadShopOrThrow(fields.target_shop_id);
    if (fields.target_type === "device") await loadDeviceOrThrow(fields.target_device_id);

    const admin = supabaseAdmin();
    const payload = {
      release_id: fields.release_id,
      target_type: fields.target_type,
      target_shop_id: fields.target_type === "shop" ? fields.target_shop_id : null,
      target_device_id: fields.target_type === "device" ? fields.target_device_id : null,
      channel: fields.channel,
      required: fields.required,
      status: fields.status,
      starts_at: fields.starts_at || null,
    };

    if (fields.rollout_id) {
      await loadRolloutOrThrow(fields.rollout_id);
      const { error } = await admin.from("rb_software_rollouts").update(payload).eq("id", fields.rollout_id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await admin.from("rb_software_rollouts").insert(payload);
      if (error) throw new Error(error.message);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Rollout save failed.";
    redirect(encodeRolloutEditorUrl({ rolloutMode, error: message, fields }));
  }

  revalidatePath("/software-updates");
  redirect(encodeRolloutEditorUrl({ flash: fields.rollout_id ? "Rollout updated." : "Rollout created." }));
}

export async function activateSoftwareRolloutAction(formData: FormData) {
  await requirePlatformAdminAal2();
  const rolloutId = asText(formData.get("rollout_id"));
  if (!rolloutId) redirect(encodeRolloutEditorUrl({ error: "Rollout id is required." }));

  try {
    await loadRolloutOrThrow(rolloutId);
    const admin = supabaseAdmin();
    const { error } = await admin.from("rb_software_rollouts").update({ status: "active" }).eq("id", rolloutId);
    if (error) throw new Error(error.message);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Rollout activation failed.";
    redirect(encodeRolloutEditorUrl({ error: message }));
  }

  revalidatePath("/software-updates");
  redirect(encodeRolloutEditorUrl({ flash: "Rollout activated." }));
}

export async function pauseSoftwareRolloutAction(formData: FormData) {
  await requirePlatformAdminAal2();
  const rolloutId = asText(formData.get("rollout_id"));
  if (!rolloutId) redirect(encodeRolloutEditorUrl({ error: "Rollout id is required." }));

  try {
    await loadRolloutOrThrow(rolloutId);
    const admin = supabaseAdmin();
    const { error } = await admin.from("rb_software_rollouts").update({ status: "paused" }).eq("id", rolloutId);
    if (error) throw new Error(error.message);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Rollout pause failed.";
    redirect(encodeRolloutEditorUrl({ error: message }));
  }

  revalidatePath("/software-updates");
  redirect(encodeRolloutEditorUrl({ flash: "Rollout paused." }));
}

export async function cancelSoftwareRolloutAction(formData: FormData) {
  await requirePlatformAdminAal2();
  const rolloutId = asText(formData.get("rollout_id"));
  if (!rolloutId) redirect(encodeRolloutEditorUrl({ error: "Rollout id is required." }));

  try {
    await loadRolloutOrThrow(rolloutId);
    const admin = supabaseAdmin();
    const { error } = await admin.from("rb_software_rollouts").update({ status: "cancelled" }).eq("id", rolloutId);
    if (error) throw new Error(error.message);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Rollout cancel failed.";
    redirect(encodeRolloutEditorUrl({ error: message }));
  }

  revalidatePath("/software-updates");
  redirect(encodeRolloutEditorUrl({ flash: "Rollout cancelled." }));
}
