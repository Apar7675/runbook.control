import { supabaseAdmin } from "@/lib/supabase/admin";

type StorageListItem = {
  name?: string | null;
  id?: string | null;
  metadata?: Record<string, unknown> | null;
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

function joinPath(prefix: string, name: string) {
  const cleanPrefix = text(prefix).replace(/^\/+|\/+$/g, "");
  const cleanName = text(name).replace(/^\/+|\/+$/g, "");
  return cleanPrefix ? `${cleanPrefix}/${cleanName}` : cleanName;
}

function looksLikeFolder(item: StorageListItem) {
  return !item.id && !item.metadata;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function removePathsWithRetry(bucket: string, paths: string[]) {
  const admin = supabaseAdmin();
  const deletedPaths: string[] = [];
  const failed: Array<{ path: string; error: string }> = [];
  const batchSize = 25;
  const maxAttempts = 3;

  for (let index = 0; index < paths.length; index += batchSize) {
    const batch = paths.slice(index, index + batchSize);
    let lastError = "";

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const { error } = await admin.storage.from(bucket).remove(batch);
      if (!error) {
        deletedPaths.push(...batch);
        lastError = "";
        break;
      }

      lastError = error.message;
      if (attempt < maxAttempts) {
        await sleep(350 * attempt);
      }
    }

    if (lastError) {
      failed.push(...batch.map((path) => ({ path, error: lastError })));
    }
  }

  if (failed.length > 0) {
    const sample = failed.slice(0, 3).map((row) => row.path).join(", ");
    throw new Error(`Storage cleanup failed in ${bucket}: ${failed.length} path(s) could not be removed. ${sample ? `Sample: ${sample}. ` : ""}${failed[0]?.error ?? ""}`);
  }

  return deletedPaths;
}

async function collectBucketPaths(bucket: string, prefix: string, paths: string[] = []) {
  const admin = supabaseAdmin();
  const normalizedPrefix = text(prefix).replace(/^\/+|\/+$/g, "");
  const slashIndex = normalizedPrefix.lastIndexOf("/");
  const listPath = slashIndex >= 0 ? normalizedPrefix.slice(0, slashIndex) : "";
  const targetName = slashIndex >= 0 ? normalizedPrefix.slice(slashIndex + 1) : normalizedPrefix;

  const { data, error } = await admin.storage.from(bucket).list(listPath || "", {
    limit: 1000,
    offset: 0,
    sortBy: { column: "name", order: "asc" },
  });

  if (error) throw new Error(error.message);

  for (const raw of data ?? []) {
    const item = raw as StorageListItem;
    const name = text(item.name);
    if (!name) continue;
    if (targetName && name !== targetName) continue;

    const fullPath = joinPath(listPath, name);
    if (looksLikeFolder(item)) {
      await collectBucketPaths(bucket, fullPath, paths);
      continue;
    }

    paths.push(fullPath);
  }

  return paths;
}

export async function deleteShopAvatars(shopId: string) {
  const admin = supabaseAdmin();
  const prefix = `shops/${shopId}`;
  const paths = [...new Set(await collectBucketPaths("avatars", prefix))];

  if (paths.length === 0) {
    return { bucket: "avatars", prefix, deleted_paths: [] as string[], count: 0 };
  }

  const deletedPaths = await removePathsWithRetry("avatars", paths);

  return { bucket: "avatars", prefix, deleted_paths: deletedPaths, count: deletedPaths.length };
}

export async function deleteSupportBundles(shopId: string) {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("rb_support_bundles")
    .select("id,file_path")
    .eq("shop_id", shopId);

  if (error) throw new Error(error.message);

  const paths = [...new Set((data ?? [])
    .map((row: any) => text(row?.file_path))
    .filter(Boolean))];

  if (paths.length === 0) {
    return { bucket: "rb-support-bundles", deleted_paths: [] as string[], count: 0 };
  }

  const deletedPaths = await removePathsWithRetry("rb-support-bundles", paths);

  return { bucket: "rb-support-bundles", deleted_paths: deletedPaths, count: deletedPaths.length };
}
