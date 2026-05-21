"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePlatformAdminAal2 } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabase/admin";

const allowedApps = new Set(["desktop", "service", "workstation", "mobile", "control"]);
const allowedChannels = new Set(["dev", "beta", "stable"]);
const allowedStatuses = new Set(["draft", "active", "retired", "blocked"]);

type ReleaseEditorFields = {
  release_id?: string;
  app_name: string;
  version: string;
  channel: string;
  status: string;
  required: boolean;
  release_notes: string;
  minimum_supported_version: string;
  rollback_version: string;
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
  if (fields.release_notes) params.set("release_notes", fields.release_notes);
  if (fields.minimum_supported_version) params.set("minimum_supported_version", fields.minimum_supported_version);
  if (fields.rollback_version) params.set("rollback_version", fields.rollback_version);

  return `/software-updates?${params.toString()}`;
}

function readReleaseFields(formData: FormData): ReleaseEditorFields {
  return {
    release_id: asOptionalText(formData.get("release_id")) || undefined,
    app_name: asText(formData.get("app_name")).toLowerCase(),
    version: asText(formData.get("version")),
    channel: asText(formData.get("channel")).toLowerCase(),
    status: asText(formData.get("status")).toLowerCase() || "draft",
    required: asBoolean(formData.get("required")),
    release_notes: asOptionalText(formData.get("release_notes")),
    minimum_supported_version: asOptionalText(formData.get("minimum_supported_version")),
    rollback_version: asOptionalText(formData.get("rollback_version")),
  };
}

function validateReleaseFields(fields: ReleaseEditorFields) {
  if (!allowedApps.has(fields.app_name)) return "Choose a valid app.";
  if (!fields.version) return "Version is required.";
  if (!allowedChannels.has(fields.channel)) return "Choose a valid channel.";
  if (!allowedStatuses.has(fields.status)) return "Choose a valid status.";
  return "";
}

async function loadReleaseOrThrow(releaseId: string) {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("rb_software_releases")
    .select("id,published_at")
    .eq("id", releaseId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error("Release not found.");
  return data;
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

  try {
    if (fields.release_id) {
      const existing = await loadReleaseOrThrow(fields.release_id);
      const payload = {
        app_name: fields.app_name,
        version: fields.version,
        channel: fields.channel,
        status: fields.status,
        required: fields.required,
        release_notes: fields.release_notes || null,
        minimum_supported_version: fields.minimum_supported_version || null,
        rollback_version: fields.rollback_version || null,
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
        required: fields.required,
        release_notes: fields.release_notes || null,
        minimum_supported_version: fields.minimum_supported_version || null,
        rollback_version: fields.rollback_version || null,
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
